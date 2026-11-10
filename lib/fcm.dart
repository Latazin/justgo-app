// JustGo — avisos instantâneos (Firebase Cloud Messaging)
//   Quando alguém segue, curte, comenta, responde ou curte seu comentário, o servidor
//   (função push-send do Supabase) manda o aviso na hora para este celular.
//   Sem o arquivo google-services.json o Firebase não liga e o app continua usando
//   a checagem a cada ~15 min (Push.pull em notif.dart).
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'notif.dart';

// mensagem com o app fechado: o Android já mostra sozinho (mensagem com "notification")
@pragma('vm:entry-point')
Future<void> jgFcmBackground(RemoteMessage m) async {}

class Fcm {
  static bool on = false;
  static String? error;
  static void Function(String title, String body, String go)? onForeground;

  static String goOf(RemoteMessage m) {
    final d = m.data;
    final go = '${d['go'] ?? 'notifs'}', v = '${d['v'] ?? ''}';
    return v.isEmpty ? go : '$go:$v';
  }

  static Future<void> init() async {
    if (!Platform.isAndroid) return;
    try {
      await Firebase.initializeApp();
      on = true;
    } catch (e) {
      error = '$e'; // sem google-services.json: segue sem avisos instantâneos
      return;
    }
    try {
      // canal dos avisos sociais criado antes (o Firebase usa o mesmo)
      await Notif.p.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(const AndroidNotificationChannel(
            'jg_social',
            'Seguidores, curtidas e comentários',
            description: 'Quando alguém segue você, curte ou comenta um treino',
            importance: Importance.high,
          ));
      FirebaseMessaging.onBackgroundMessage(jgFcmBackground);
      // app aberto: mostra dentro do app (e no celular, se estiver em segundo plano)
      FirebaseMessaging.onMessage.listen((m) async {
        final n = m.notification;
        final t = n?.title ?? '${m.data['title'] ?? 'JustGo'}', b = n?.body ?? '${m.data['body'] ?? ''}';
        final sp = await SharedPreferences.getInstance();
        final fg = sp.getInt('jg_fg') ?? 0;
        if (fg > 0 && onForeground != null) {
          onForeground!(t, b, goOf(m));
        } else {
          await Notif.show(9000 + DateTime.now().millisecondsSinceEpoch ~/ 1000 % 900, t, b, payload: goOf(m));
        }
      });
      // toque no aviso com o app em segundo plano
      FirebaseMessaging.onMessageOpenedApp.listen((m) => Notif.onAction?.call(goOf(m)));
      // toque no aviso com o app fechado: espera a tela carregar
      final first = await FirebaseMessaging.instance.getInitialMessage();
      if (first != null) Future.delayed(const Duration(seconds: 3), () => Notif.onAction?.call(goOf(first)));
      FirebaseMessaging.instance.onTokenRefresh.listen((_) => register());
    } catch (e) {
      error = '$e';
    }
  }

  // liga o código do Firebase ao token deste celular na conta (função push_fcm do banco)
  static Future<bool> register() async {
    if (!on) return false;
    final sp = await SharedPreferences.getInstance();
    await sp.reload();
    final url = sp.getString('jg_url'), key = sp.getString('jg_key'), tok = sp.getString('jg_tok');
    if (url == null || key == null || tok == null) {
      await sp.setBool('jg_fcmOk', false);
      return false;
    }
    final c = HttpClient()..connectionTimeout = const Duration(seconds: 15);
    try {
      final fcm = await FirebaseMessaging.instance.getToken();
      if (fcm == null) return false;
      final req = await c.postUrl(Uri.parse('$url/rest/v1/rpc/push_fcm'));
      req.headers.set('apikey', key);
      req.headers.set('Authorization', 'Bearer $key');
      req.headers.contentType = ContentType.json;
      req.write(jsonEncode({'tok': tok, 'fcm': fcm, 'social': sp.getBool('jg_social') != false}));
      final res = await req.close().timeout(const Duration(seconds: 20));
      await res.drain();
      final ok = res.statusCode >= 200 && res.statusCode < 300;
      await sp.setBool('jg_fcmOk', ok); // com o Firebase ok, a checagem de 15 min não repete os avisos
      if (!ok) error = 'push_fcm ${res.statusCode}';
      return ok;
    } catch (e) {
      error = '$e';
      return false;
    } finally {
      c.close(force: true);
    }
  }
}
