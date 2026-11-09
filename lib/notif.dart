// JustGo — notificações do celular
//   • treino ao vivo: distância, tempo e ritmo na notificação e na tela de bloqueio,
//     com botões Pausar/Retomar e Finalizar
//   • social: quando alguém segue, curte ou comenta um treino (checa a cada ~15 min,
//     mesmo com o app fechado, sem Firebase)
//   • lembretes para treinar, uma vez por dia no fim da tarde, com frases que variam
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:isolate';
import 'dart:math' as math;
import 'dart:ui' show IsolateNameServer, Color;

import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';

const kLiveId = 75415; // mesmo ID da notificação fixa do GPS: trocamos o texto dela pelos números do treino
const kLiveChannel = 'geolocator_channel_01';
const _kPort = 'jg_notif_actions';
const _kTask = 'jg_check';

// toque num botão da notificação com o app em segundo plano: avisa o app principal
@pragma('vm:entry-point')
void jgNotifBackground(NotificationResponse r) {
  IsolateNameServer.lookupPortByName(_kPort)?.send(r.actionId ?? '');
}

// tarefa periódica (Android WorkManager): roda mesmo com o app fechado
@pragma('vm:entry-point')
void jgWorker() {
  Workmanager().executeTask((task, input) async {
    WidgetsFlutterBinding.ensureInitialized();
    try {
      await Notif.init();
      await Push.pull();
      await Push.remind();
    } catch (_) {}
    return true;
  });
}

class Notif {
  static final p = FlutterLocalNotificationsPlugin();
  static bool _ready = false;
  static void Function(String action)? onAction;
  static ReceivePort? _rx;
  static String? lastError;

  static Future<void> init({bool main = false}) async {
    if (main && _rx == null) {
      _rx = ReceivePort();
      IsolateNameServer.removePortNameMapping(_kPort);
      IsolateNameServer.registerPortWithName(_rx!.sendPort, _kPort);
      _rx!.listen((m) => onAction?.call('$m'));
    }
    if (_ready) return;
    for (final icon in ['ic_stat_justgo', '@mipmap/ic_launcher']) {
      try {
        await p.initialize(
          settings: InitializationSettings(
            android: AndroidInitializationSettings(icon),
            iOS: const DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
          ),
          onDidReceiveNotificationResponse: (r) => onAction?.call((r.actionId ?? '').isNotEmpty ? r.actionId! : (r.payload ?? 'open')),
          onDidReceiveBackgroundNotificationResponse: jgNotifBackground,
        );
        _ready = true;
        lastError = null;
        return;
      } catch (e) {
        lastError = '$e';
      }
    }
  }

  // pede a permissão de notificação (Android 13+ e iPhone)
  static Future<bool> ask() async {
    await init();
    if (Platform.isAndroid) {
      return await p.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission() ?? false;
    }
    return await p.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()?.requestPermissions(alert: true, badge: true, sound: true) ?? false;
  }

  static Future<bool> enabled() async {
    await init();
    if (Platform.isAndroid) return await p.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.areNotificationsEnabled() ?? false;
    return true;
  }

  static Future<void> show(int id, String title, String body, {String channel = 'social', String payload = 'open'}) async {
    await init();
    final social = channel == 'social';
    await p.show(
      id: id,
      title: title,
      body: body,
      payload: payload,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          social ? 'jg_social' : 'jg_lembretes',
          social ? 'Seguidores, curtidas e comentários' : 'Lembretes para treinar',
          channelDescription: social ? 'Quando alguém segue você, curte ou comenta um treino' : 'Um lembrete por dia para não perder o ritmo',
          importance: social ? Importance.high : Importance.defaultImportance,
          priority: social ? Priority.high : Priority.defaultPriority,
          color: const Color(0xFF1858F0),
          styleInformation: BigTextStyleInformation(body),
          groupKey: social ? 'jg_social' : null,
        ),
        iOS: const DarwinNotificationDetails(),
      ),
    );
  }

  /* ---------- treino ao vivo ---------- */
  static Future<void> live({
    required String sport,
    required double meters,
    required int movingMs,
    required bool paused,
    required bool speed,
    required int color,
  }) async {
    if (!Platform.isAndroid) return;
    await init();
    final km = (meters / 1000).toStringAsFixed(2).replaceAll('.', ',');
    final secs = movingMs ~/ 1000;
    String pace;
    if (speed) {
      final kmh = secs > 0 ? meters / secs * 3.6 : 0;
      pace = '${kmh.toStringAsFixed(1).replaceAll('.', ',')} km/h';
    } else {
      final sPerKm = meters > 30 ? secs / (meters / 1000) : 0;
      pace = sPerKm > 0 && sPerKm < 3600 ? '${_mmss(sPerKm.round())} /km' : '–:– /km';
    }
    final body = paused ? 'Pausado · ${_clock(secs)}' : '${speed ? 'Velocidade' : 'Ritmo'} $pace';
    await p.show(
      id: kLiveId,
      title: '$sport · $km km',
      body: body,
      payload: 'open',
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          kLiveChannel,
          'Treino em andamento',
          channelDescription: 'Distância, tempo e ritmo enquanto você treina',
          importance: Importance.low,
          priority: Priority.low,
          ongoing: true,
          autoCancel: false,
          onlyAlertOnce: true,
          silent: true,
          showWhen: !paused,
          when: paused ? null : DateTime.now().millisecondsSinceEpoch - movingMs,
          usesChronometer: !paused,
          subText: paused ? 'Treino pausado' : 'Treino em andamento',
          color: Color(color),
          visibility: NotificationVisibility.public,
          category: AndroidNotificationCategory.workout,
          actions: [
            AndroidNotificationAction(paused ? 'resume' : 'pause', paused ? 'Retomar' : 'Pausar', cancelNotification: false),
            const AndroidNotificationAction('finish', 'Finalizar', showsUserInterface: true, cancelNotification: false),
          ],
        ),
      ),
    );
  }

  static Future<void> liveOff() async {
    try {
      await p.cancel(id: kLiveId);
    } catch (_) {}
  }

  static String _mmss(int s) => '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
  static String _clock(int s) => s >= 3600 ? '${s ~/ 3600}:${((s % 3600) ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}' : _mmss(s);
}

/* ---------- social e lembretes (tarefa a cada ~15 min) ---------- */
class Push {
  // o app web manda: url/chave do Supabase, token do celular, nome, último treino, ofensiva e preferências
  static Future<void> setup(Map<String, dynamic> a) async {
    final sp = await SharedPreferences.getInstance();
    for (final e in a.entries) {
      final v = e.value;
      final k = 'jg_${e.key}';
      if (v == null) {
        await sp.remove(k);
      } else if (v is bool) {
        await sp.setBool(k, v);
      } else if (v is int) {
        await sp.setInt(k, v);
      } else if (v is num) {
        await sp.setInt(k, v.round());
      } else {
        await sp.setString(k, '$v');
      }
    }
    if (a['tok'] != null && sp.getString('jg_since') == null) {
      await sp.setString('jg_since', DateTime.now().toUtc().toIso8601String());
    }
    await schedule();
  }

  static Future<void> schedule() async {
    if (!Platform.isAndroid) return;
    await Workmanager().initialize(jgWorker);
    await Workmanager().registerPeriodicTask(
      _kTask,
      _kTask,
      frequency: const Duration(minutes: 15),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
      constraints: Constraints(networkType: NetworkType.connected),
    );
  }

  static Future<void> foreground(bool on) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setInt('jg_fg', on ? DateTime.now().millisecondsSinceEpoch : 0);
  }

  static Future<void> pull() async {
    final sp = await SharedPreferences.getInstance();
    await sp.reload();
    final url = sp.getString('jg_url'), key = sp.getString('jg_key'), tok = sp.getString('jg_tok');
    if (url == null || key == null || tok == null) return;
    final since = sp.getString('jg_since');
    final c = HttpClient()..connectionTimeout = const Duration(seconds: 15);
    try {
      final req = await c.postUrl(Uri.parse('$url/rest/v1/rpc/push_pull'));
      req.headers.set('apikey', key);
      req.headers.set('Authorization', 'Bearer $key');
      req.headers.contentType = ContentType.json;
      req.write(jsonEncode({'tok': tok, 'since': since}));
      final res = await req.close().timeout(const Duration(seconds: 20));
      final body = await res.transform(utf8.decoder).join();
      if (res.statusCode != 200) return;
      final j = jsonDecode(body);
      if (j is! Map || j['ok'] != true) return;
      await sp.setString('jg_since', '${j['now']}');
      final items = (j['items'] as List?) ?? [];
      if (items.isEmpty || sp.getBool('jg_social') == false) return;
      // app aberto na tela: o sininho já mostra
      final fg = sp.getInt('jg_fg') ?? 0;
      if (fg > 0 && DateTime.now().millisecondsSinceEpoch - fg < 20 * 60000) return;
      if (items.length > 4) {
        final n = items.length;
        await Notif.show(9100, 'Movimento no seu JustGo', '${_first(items[0]['n'])} e mais ${n - 1} ${n - 1 == 1 ? 'pessoa interagiram' : 'interações'} com você. Toque para ver.', payload: 'notifs');
        return;
      }
      var i = 0;
      for (final it in items.reversed) {
        final name = _first(it['n']);
        final title = (it['title'] ?? '').toString().trim();
        final tr = title.isEmpty ? 'seu treino' : '"$title"';
        String t, b;
        switch (it['k']) {
          case 'follow':
            t = '$name começou a seguir você';
            b = 'Veja o perfil e siga de volta.';
            break;
          case 'like':
            t = '$name curtiu seu treino';
            b = 'Curtiu $tr.';
            break;
          default:
            t = '$name comentou no seu treino';
            b = '"${it['text'] ?? ''}"';
        }
        await Notif.show(9000 + (DateTime.now().millisecondsSinceEpoch ~/ 1000 + i++) % 900, t, b, payload: 'notifs');
      }
    } catch (_) {
    } finally {
      c.close(force: true);
    }
  }

  static String _first(dynamic n) {
    final s = (n ?? 'Alguém').toString().trim();
    return s.isEmpty ? 'Alguém' : s.split(' ').first;
  }

  /* ---------- lembrete para treinar (1 por dia, no fim da tarde) ---------- */
  static const _plain = [
    'Que tal uns minutinhos de treino hoje? Seu corpo agradece.',
    'O dia ainda não acabou. Bora sair para um treino rápido?',
    'Só 20 minutos já contam. Calça o tênis e vai!',
    'Treino curto vale mais que treino nenhum. Bora?',
    'O fim de tarde está pedindo uma volta. Partiu?',
    'Seu próximo treino está esperando você. Toque em Gravar!',
    'Cada quilômetro conta para a sua meta da semana.',
    'Ninguém se arrepende de ter treinado. Vamos nessa?',
    'Suas missões de hoje ainda estão abertas. Que tal completar?',
    'Bora conquistar território hoje? O mapa está esperando.',
    'Um treino leve hoje deixa amanhã mais fácil.',
    'Hora boa para se mexer. Corrida, pedal ou nado?',
    'Desliga a tela um pouco e vai treinar. Depois você conta pra galera.',
    'Seus amigos já treinaram hoje. E você?',
    'Dia sem treino? Ainda dá tempo de virar o jogo.',
  ];
  static const _streak = [
    'Sua ofensiva de {s} dias acaba à meia-noite. Um treino curto salva!',
    '{s} dias seguidos! Não deixa a sequência cair hoje.',
    'Falta só o treino de hoje para a ofensiva chegar a {s1} dias.',
    'Ofensiva de {s} dias em risco. Bora manter o fogo aceso?',
  ];

  static Future<void> remind() async {
    final sp = await SharedPreferences.getInstance();
    await sp.reload();
    if (sp.getBool('jg_remind') == false || sp.getString('jg_url') == null) return;
    final now = DateTime.now();
    final hour = sp.getInt('jg_remindHour') ?? 18;
    if (now.hour < hour || now.hour >= hour + 3) return;
    final today = '${now.year}-${now.month}-${now.day}';
    if (sp.getString('jg_lastRemind') == today) return;
    final last = DateTime.fromMillisecondsSinceEpoch(sp.getInt('jg_lastTrain') ?? 0);
    if (last.year == now.year && last.month == now.month && last.day == now.day) return; // já treinou hoje
    final fg = sp.getInt('jg_fg') ?? 0;
    if (fg > 0 && now.millisecondsSinceEpoch - fg < 20 * 60000) return; // está usando o app agora
    final streak = sp.getInt('jg_streak') ?? 0;
    final name = (sp.getString('jg_name') ?? '').trim().split(' ').first;
    final rnd = math.Random();
    final recent = (sp.getStringList('jg_recentPhrases') ?? []);
    final useStreak = streak > 0 && rnd.nextInt(3) > 0;
    final pool = useStreak ? _streak : _plain;
    final prefix = useStreak ? 's' : 'p';
    final options = List.generate(pool.length, (i) => i).where((i) => !recent.contains('$prefix$i')).toList();
    final pick = options.isEmpty ? rnd.nextInt(pool.length) : options[rnd.nextInt(options.length)];
    final body = pool[pick].replaceAll('{s1}', '${streak + 1}').replaceAll('{s}', '$streak');
    final titles = useStreak
        ? ['Sua ofensiva está em jogo', 'Não perde a sequência', 'O fogo ainda está aceso']
        : [name.isEmpty ? 'Bora treinar?' : 'Bora treinar, $name?', 'Hora de se mexer', 'Seu treino de hoje', 'Partiu treino?'];
    await Notif.show(9500, titles[rnd.nextInt(titles.length)], body, channel: 'lembretes', payload: 'record');
    await sp.setString('jg_lastRemind', today);
    await sp.setStringList('jg_recentPhrases', ([...recent, '$prefix$pick']).reversed.take(8).toList().reversed.toList());
  }
}
