// JustGo — app Android (Flutter)
//
// O app roda a interface do JustGo (assets/web) num servidor local e
// num WebView, e cuida nativamente do que o navegador não faz bem:
//   • GPS em segundo plano com notificação fixa durante o treino
//   • tela sempre acesa, voz do treinador, compartilhar arquivos
//   • login com Google pelo navegador + retorno por link (justgo://)
//   • escolher arquivos (GPX, backup) e o botão "voltar" do Android
//   • atualização automática: baixa o visual novo do site sem reinstalar
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:app_links/app_links.dart';
import 'package:crypto/crypto.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';
import 'package:workmanager/workmanager.dart';

import 'notif.dart';

const kBrand = Color(0xFF1F6BFF);
const kPort = 47621; // porta fixa: mantém os dados salvos entre aberturas
// atualizações vêm do próprio repositório do app no GitHub (grátis):
// version.json direto do GitHub (sempre fresco) e os arquivos pela CDN jsDelivr
const kRaw = 'https://raw.githubusercontent.com/Latazin/justgo-app/main/assets/web';
const kCdn = 'https://cdn.jsdelivr.net/gh/Latazin/justgo-app@main/assets/web';
const kNativeBuild = 30; // sobe quando o APK ganha recursos novos
// AdMob: um bloco de anúncio premiado para cada recompensa
const kAdUnits = {
  'streak': 'ca-app-pub-4705801610677571/3371244610', // salvar ofensiva
  'shield': 'ca-app-pub-4705801610677571/9745081274', // escudo de território
  'xp': 'ca-app-pub-4705801610677571/5781785537',     // dobrar XP
  'trial': 'ca-app-pub-4705801610677571/2346946717',  // testar função 24 h
};
// iPhone (AltStore): por enquanto anúncio de TESTE do Google (trocar quando criar o app iOS no AdMob)
const kAdUnitIOS = 'ca-app-pub-3940256099942544/1712485313';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  unawaited(MobileAds.instance.initialize().then((_) => Ads.preloadAll()).catchError((_) {}));
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: kBrand,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: kBrand,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  try {
    await Notif.init(main: true);
    if (Platform.isAndroid) await Workmanager().initialize(jgWorker);
  } catch (_) {}
  await WebFiles.init();
  final base = await LocalServer.start();
  runApp(JustGoApp(base: base));
}

/* ---------------- servidor local dos arquivos do app ---------------- */
class LocalServer {
  static HttpServer? _server;

  static Future<String> start() async {
    try {
      _server = await HttpServer.bind(InternetAddress.loopbackIPv4, kPort, shared: true);
    } catch (_) {
      _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    }
    _server!.listen(_handle);
    return 'http://127.0.0.1:${_server!.port}';
  }

  static const _types = {
    'html': 'text/html; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'json': 'application/json',
    'webmanifest': 'application/manifest+json',
    'svg': 'image/svg+xml',
    'png': 'image/png',
    'ico': 'image/x-icon',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'woff2': 'font/woff2',
  };

  static Future<void> _handle(HttpRequest req) async {
    var path = Uri.decodeComponent(req.uri.path);
    if (path == '/' || path.isEmpty) path = '/index.html';
    final data = path.contains('..') ? null : await WebFiles.read(path);
    if (data == null) {
      req.response.statusCode = HttpStatus.notFound;
    } else {
      final ext = path.split('.').last.toLowerCase();
      req.response.headers.set('Content-Type', _types[ext] ?? 'application/octet-stream');
      req.response.headers.set('Cache-Control', 'no-cache');
      req.response.add(data);
    }
    await req.response.close();
  }
}

/* ---------------- arquivos do app: versão baixada ou a que veio no APK ---------------- */
class WebFiles {
  static Directory? _live; // pasta com a versão baixada do site
  static int assetBuild = 0, liveBuild = 0, remoteBuild = 0;
  static bool _busy = false;
  static String lastStatus = 'nunca verificado';

  static int get current => _live != null ? liveBuild : assetBuild;

  static Future<Directory> _dir(String name) async => Directory('${(await getApplicationSupportDirectory()).path}/$name');

  static int _buildOf(String json) {
    try {
      return ((jsonDecode(json) as Map)['build'] as num).toInt();
    } catch (_) {
      return 0;
    }
  }

  static Future<void> init() async {
    try {
      assetBuild = _buildOf(await rootBundle.loadString('assets/web/version.json'));
    } catch (_) {}
    try {
      final d = await _dir('web');
      final v = File('${d.path}/version.json');
      if (await v.exists()) {
        final b = _buildOf(await v.readAsString());
        if (b > assetBuild) {
          _live = d;
          liveBuild = b;
        } else {
          await d.delete(recursive: true); // o APK já é mais novo
        }
      }
    } catch (_) {}
  }

  static Future<List<int>?> read(String path) async {
    if (_live != null) {
      final f = File('${_live!.path}$path');
      if (await f.exists()) return f.readAsBytes();
    }
    try {
      final d = await rootBundle.load('assets/web$path');
      return d.buffer.asUint8List(d.offsetInBytes, d.lengthInBytes);
    } catch (_) {
      return null;
    }
  }

  static Future<List<int>> _get(HttpClient c, String url) async {
    final req = await c.getUrl(Uri.parse(url));
    req.headers.set('Cache-Control', 'no-cache');
    final res = await req.close().timeout(const Duration(seconds: 40));
    if (res.statusCode != 200) throw Exception('HTTP ${res.statusCode}');
    final b = BytesBuilder(copy: false);
    await for (final chunk in res) {
      b.add(chunk);
    }
    return b.takeBytes();
  }

  /// Procura versão nova no site. Devolve o número dela se baixou tudo.
  static Future<int?> update() async {
    if (_busy) return null;
    _busy = true;
    final c = HttpClient()..connectionTimeout = const Duration(seconds: 12);
    try {
      final raw = utf8.decode(await _get(c, '$kRaw/version.json?t=${DateTime.now().millisecondsSinceEpoch}'));
      final v = jsonDecode(raw) as Map<String, dynamic>;
      final b = (v['build'] as num).toInt();
      remoteBuild = b;
      if (b <= current) { lastStatus = 'em dia'; return null; }
      if (((v['minNative'] ?? 0) as num).toInt() > kNativeBuild) { lastStatus = 'precisa de APK novo'; return null; }
      final tmp = await _dir('web_new');
      if (await tmp.exists()) await tmp.delete(recursive: true);
      await tmp.create(recursive: true);
      for (final f in (v['files'] as List)) {
        final p = '${f['p']}';
        if (p.contains('..')) continue;
        // reaproveita o que não mudou
        List<int>? data = await read('/$p');
        if (data == null || sha256.convert(data).toString() != f['s']) {
          try {
            data = await _get(c, '$kCdn/$p');
          } catch (_) {
            data = null;
          }
          // a CDN pode demorar para pegar a versão nova: confere e, se preciso, busca direto no GitHub
          if (data == null || sha256.convert(data).toString() != f['s']) data = await _get(c, '$kRaw/$p?v=$b');
          if (sha256.convert(data).toString() != f['s']) throw Exception('arquivo corrompido: $p');
        }
        final out = File('${tmp.path}/$p');
        await out.parent.create(recursive: true);
        await out.writeAsBytes(data, flush: true);
      }
      await File('${tmp.path}/version.json').writeAsString(raw, flush: true);
      final live = await _dir('web'), old = await _dir('web_old');
      if (await old.exists()) await old.delete(recursive: true);
      if (await live.exists()) await live.rename(old.path);
      await tmp.rename(live.path);
      _live = live;
      liveBuild = b;
      if (await old.exists()) await old.delete(recursive: true);
      lastStatus = 'baixada';
      return b;
    } catch (e) {
      lastStatus = 'erro: $e';
      return null;
    } finally {
      c.close(force: true);
      _busy = false;
    }
  }
}

class JustGoApp extends StatelessWidget {
  final String base;
  const JustGoApp({super.key, required this.base});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'JustGo',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(brightness: Brightness.light, scaffoldBackgroundColor: kBrand, colorSchemeSeed: kBrand),
      home: Shell(base: base),
    );
  }
}

class Shell extends StatefulWidget {
  final String base;
  const Shell({super.key, required this.base});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> with WidgetsBindingObserver {
  late final WebViewController _web;
  final _tts = FlutterTts();
  final _links = AppLinks();
  StreamSubscription<Position>? _gps;
  StreamSubscription<Uri>? _linkSub;
  bool _ready = false, _training = false, _watching = false;
  String? _pendingLink;
  Color _bg = kBrand;
  int? _updateReady;
  DateTime _lastCheck = DateTime.fromMillisecondsSinceEpoch(0);
  DateTime? _pausedAt;
  Map<String, dynamic>? _live; // números do treino vindos do app web (para a notificação)
  int _liveAt = 0, _liveIdx = 0;
  Timer? _liveTimer;
  final List<Map<String, dynamic>> _trainBuffer = []; // pontos do treino (reenviados ao voltar)
  int _sentUpTo = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _setupWebView();
    _setupTts();
    _setupLinks();
    Notif.onAction = _onNotifAction;
    Push.foreground(true);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _gps?.cancel();
    _linkSub?.cancel();
    super.dispose();
  }

  /* ---------------- WebView ---------------- */
  void _setupWebView() {
    // iPhone: vídeos tocam dentro da página (vídeo 3D, retrospectiva) sem abrir em tela cheia
    final PlatformWebViewControllerCreationParams params = Platform.isIOS
        ? WebKitWebViewControllerCreationParams(allowsInlineMediaPlayback: true, mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{})
        : const PlatformWebViewControllerCreationParams();
    final c = WebViewController.fromPlatformCreationParams(params);
    c
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(kBrand)
      ..addJavaScriptChannel('JustGoNative', onMessageReceived: (m) => _onMessage(m.message))
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: (req) {
          final url = req.url;
          if (url.startsWith(widget.base) || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:') || !req.isMainFrame) {
            return NavigationDecision.navigate;
          }
          // Google, Supabase, WhatsApp, telefone, mapas… abrem fora do app
          _openExternal(url);
          return NavigationDecision.prevent;
        },
        onPageFinished: (_) {
          _ready = true;
          _checkUpdate();
          if (_pendingLink != null) {
            final l = _pendingLink!;
            _pendingLink = null;
            Future.delayed(const Duration(milliseconds: 600), () => _deliverLink(l));
          }
        },
      ));
    final p = c.platform;
    if (p is AndroidWebViewController) {
      p.setMediaPlaybackRequiresUserGesture(false);
      p.setOnShowFileSelector(_pickFiles);
      p.setGeolocationPermissionsPromptCallbacks(
        onShowPrompt: (_) async => const GeolocationPermissionsResponse(allow: true, retain: true),
      );
    }
    c.loadRequest(Uri.parse('${widget.base}/index.html'));
    _web = c;
  }

  Future<List<String>> _pickFiles(FileSelectorParams params) async {
    final res = await FilePicker.platform.pickFiles();
    final path = res?.files.single.path;
    if (path == null) return [];
    return [Uri.file(path).toString()];
  }

  Future<void> _js(String code) async {
    try {
      await _web.runJavaScript(code);
    } catch (_) {}
  }

  void _reply(dynamic id, Object? data) => _js('window.JG && JG._resolve(${jsonEncode(id)}, ${jsonEncode(data)})');

  /* ---------------- mensagens vindas do app web ---------------- */
  Future<void> _onMessage(String raw) async {
    Map<String, dynamic> m;
    try {
      m = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return;
    }
    final id = m['id'];
    switch (m['cmd']) {
      case 'geoGet':
        _reply(id, await _currentPosition(ask: m['ask'] == true));
        break;
      case 'geoWatch':
        final ok = await _ensurePermission();
        if (ok) await _startStream();
        _reply(id, {'ok': ok, 'denied': !ok});
        break;
      case 'geoUnwatch':
        _watching = false;
        if (!_training) await _stopStream();
        _reply(id, {'ok': true});
        break;
      case 'trainStart':
        _training = true;
        _trainBuffer.clear();
        _sentUpTo = 0;
        WakelockPlus.enable();
        _live = null;
        if (Platform.isAndroid) unawaited(Notif.ask());
        if (await _ensurePermission()) await _startStream(restart: true);
        _liveTimer?.cancel();
        _liveTimer = Timer.periodic(const Duration(seconds: 5), (_) => _liveShow());
        _reply(id, {'ok': true});
        break;
      case 'trainStop':
        _training = false;
        _liveTimer?.cancel();
        _live = null;
        if (_updateReady != null) Future.delayed(const Duration(seconds: 3), _checkUpdate);
        _trainBuffer.clear();
        WakelockPlus.disable();
        await _startStream(restart: true); // volta ao modo normal (sem notificação)
        if (!_watching) await _stopStream();
        await Notif.liveOff();
        _reply(id, {'ok': true});
        break;
      case 'say':
        await _tts.stop();
        await _tts.speak('${m['text'] ?? ''}');
        _reply(id, {'ok': true});
        break;
      case 'share':
        _reply(id, {'ok': await _shareFile('${m['name']}', '${m['mime']}', '${m['b64']}')});
        break;
      case 'haptic':
        HapticFeedback.mediumImpact();
        _reply(id, {'ok': true});
        break;
      case 'open':
        _openExternal('${m['url']}');
        _reply(id, {'ok': true});
        break;
      case 'ui': // cor da barra de status acompanha o tema do app
        {
        final hex = '${m['bg'] ?? '#F3F4F6'}'.replaceAll('#', '');
        final col = Color(int.tryParse('FF$hex', radix: 16) ?? 0xFFF3F4F6);
        final light = m['light'] == true;
        SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle(
          statusBarColor: col,
          statusBarIconBrightness: light ? Brightness.dark : Brightness.light,
          systemNavigationBarColor: col,
          systemNavigationBarIconBrightness: light ? Brightness.dark : Brightness.light,
        ));
        if (mounted) setState(() => _bg = col);
        _web.setBackgroundColor(col);
        _reply(id, {'ok': true});
        }
        break;
      case 'reload':
        _reply(id, {'ok': true});
        _updateReady = null;
        await _web.reload();
        break;
      case 'adCancel':
        Ads.cancel();
        _reply(id, {'ok': true});
        break;
      case 'adReward': // anúncio premiado: responde se a pessoa assistiu até o fim
        _reply(id, await Ads.show('${m['kind'] ?? 'xp'}'));
        break;
      case 'version':
        _reply(id, {'native': kNativeBuild, 'web': WebFiles.current, 'remote': WebFiles.remoteBuild, 'status': WebFiles.lastStatus, 'ready': _updateReady});
        break;
      case 'checkUpdate': // botão "Procurar atualização"
        await _checkUpdate(force: true);
        _reply(id, {'native': kNativeBuild, 'web': WebFiles.current, 'remote': WebFiles.remoteBuild, 'status': WebFiles.lastStatus, 'ready': _updateReady});
        break;
      case 'trainLive': // números do treino para a notificação / tela de bloqueio
        _live = Map<String, dynamic>.from(m);
        _liveAt = DateTime.now().millisecondsSinceEpoch;
        _liveIdx = _trainBuffer.length;
        _liveShow();
        _reply(id, {'ok': true});
        break;
      case 'notifSetup': // token, preferências e dados para lembretes e avisos sociais
        await Push.setup(Map<String, dynamic>.from(m['data'] as Map));
        _reply(id, {'ok': true});
        break;
      case 'notifAsk':
        _reply(id, {'ok': await Notif.ask()});
        break;
      case 'notifState':
        _reply(id, {'enabled': await Notif.enabled()});
        break;
      case 'notifTest':
        await Notif.show(9600, '${m['title'] ?? 'JustGo'}', '${m['body'] ?? ''}', channel: '${m['channel'] ?? 'social'}');
        _reply(id, {'ok': true});
        break;
      default:
        _reply(id, null);
    }
  }

  /* ---------------- notificação do treino ao vivo ---------------- */
  void _liveShow() {
    final l = _live;
    if (!_training || l == null) return;
    final paused = l['paused'] == true;
    var dist = (l['dist'] as num? ?? 0).toDouble();
    var moving = (l['moving'] as num? ?? 0).toInt();
    if (!paused) {
      moving += DateTime.now().millisecondsSinceEpoch - _liveAt;
      // pontos que chegaram com o app minimizado e o app web ainda não somou
      final from = _liveIdx.clamp(0, _trainBuffer.length);
      Map<String, dynamic>? prev = from > 0 ? _trainBuffer[from - 1] : null;
      for (var i = from; i < _trainBuffer.length; i++) {
        final q = _trainBuffer[i];
        if (((q['acc'] as num?) ?? 99) > 30) continue;
        if (prev != null) {
          final d = _hav(prev, q), dt = (((q['t'] as num) - (prev['t'] as num)) / 1000);
          if (d >= 1 && dt > 0 && d / dt < 40) dist += d;
        }
        prev = q;
      }
    }
    var color = 0xFF1858F0;
    try {
      color = int.parse('FF${'${l['color'] ?? ''}'.replaceAll('#', '')}', radix: 16);
    } catch (_) {}
    unawaited(Notif.live(sport: '${l['name'] ?? 'Treino'}', meters: dist, movingMs: moving, paused: paused, speed: l['speed'] == true, color: color));
  }

  double _hav(Map a, Map b) {
    const r = 6371000.0;
    final la1 = (a['lat'] as num) * math.pi / 180, la2 = (b['lat'] as num) * math.pi / 180;
    final dla = la2 - la1, dlo = ((b['lng'] as num) - (a['lng'] as num)) * math.pi / 180;
    final h = math.sin(dla / 2) * math.sin(dla / 2) + math.cos(la1) * math.cos(la2) * math.sin(dlo / 2) * math.sin(dlo / 2);
    return 2 * r * math.asin(math.sqrt(h));
  }

  // toque na notificação ou nos botões dela
  void _onNotifAction(String a) {
    switch (a) {
      case 'pause':
        _js("App.tracker && App.tracker.state === 'running' && App.actions.pause()");
        break;
      case 'resume':
        _js("App.tracker && App.tracker.state === 'paused' && App.actions.resume()");
        break;
      case 'finish':
        Future.delayed(const Duration(milliseconds: 500), () => _js("App.tracker && (App.tab = 'training', UI.training(), App.finishTraining())"));
        break;
      case 'notifs':
        Future.delayed(const Duration(milliseconds: 700), () => _js("window.Cloud && Cloud.loggedIn() && !App.tracker && App.go('notifs')"));
        break;
      case 'record':
        Future.delayed(const Duration(milliseconds: 700), () => _js("!App.tracker && App.go('record')"));
        break;
    }
  }

  /* ---------------- atualização automática ---------------- */
  Future<void> _checkUpdate({bool force = false}) async {
    if (_updateReady != null) {
      _js('window.JG && JG.updateReady && JG.updateReady($_updateReady)');
      return;
    }
    if (!force && DateTime.now().difference(_lastCheck).inMinutes < 3) return;
    _lastCheck = DateTime.now();
    final b = await WebFiles.update();
    if (b == null) return;
    _updateReady = b;
    if (_training) return; // avisa depois do treino
    _js('window.JG && JG.updateReady && JG.updateReady($b)');
  }

  /* ---------------- GPS nativo ---------------- */
  Future<bool> _ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      _js("window.FX && FX.toast('Ative a localização do celular para gravar o percurso.')");
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    return perm == LocationPermission.always || perm == LocationPermission.whileInUse;
  }

  Map<String, dynamic> _posJson(Position p) => {
        'lat': p.latitude,
        'lng': p.longitude,
        'alt': p.altitude,
        'acc': p.accuracy,
        'speed': p.speed,
        't': p.timestamp.millisecondsSinceEpoch,
      };

  Future<Map<String, dynamic>?> _currentPosition({bool ask = false}) async {
    if (ask) {
      if (!await _ensurePermission()) return {'denied': true};
    } else {
      final perm = await Geolocator.checkPermission();
      if (perm != LocationPermission.always && perm != LocationPermission.whileInUse) return null;
    }
    try {
      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)),
      );
      return _posJson(p);
    } catch (_) {
      final last = await Geolocator.getLastKnownPosition();
      return last == null ? null : _posJson(last);
    }
  }

  Future<void> _startStream({bool restart = false}) async {
    _watching = true;
    if (_gps != null && !restart) return;
    await _stopStream(keepFlag: true);
    // iPhone: GPS em segundo plano (barra azul no topo) enquanto grava o treino
    final LocationSettings settings = Platform.isIOS
        ? AppleSettings(
            accuracy: LocationAccuracy.bestForNavigation,
            activityType: ActivityType.fitness,
            distanceFilter: 0,
            pauseLocationUpdatesAutomatically: false,
            allowBackgroundLocationUpdates: _training,
            showBackgroundLocationIndicator: _training,
          )
        : AndroidSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: 0,
      intervalDuration: const Duration(seconds: 1),
      // durante o treino: serviço em primeiro plano = GPS continua com o app minimizado
      foregroundNotificationConfig: _training
          ? const ForegroundNotificationConfig(
              notificationTitle: 'JustGo · treino em andamento',
              notificationText: 'Gravando seu percurso. Toque para voltar ao app.',
              notificationIcon: AndroidResource(name: 'ic_stat_justgo', defType: 'drawable'),
              enableWakeLock: true,
              setOngoing: true,
            )
          : null,
    );
    _gps = Geolocator.getPositionStream(locationSettings: settings).listen((p) {
      final j = _posJson(p);
      if (_training) {
        _trainBuffer.add(j);
        if (_trainBuffer.length > 30000) _trainBuffer.removeRange(0, 5000);
      }
      _js('window.JG && JG._pos(${jsonEncode(j)})');
    }, onError: (e) => _js("window.JG && JG._geoError(2, 'Sem sinal de GPS')"));
  }

  Future<void> _stopStream({bool keepFlag = false}) async {
    if (!keepFlag) _watching = false;
    await _gps?.cancel();
    _gps = null;
  }

  // voltou para o app: reenvia os pontos gravados em segundo plano
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_training) {
      // atualização pronta e a pessoa ficou fora do app: aplica sozinho ao voltar
      final away = _pausedAt == null ? 0 : DateTime.now().difference(_pausedAt!).inSeconds;
      if (_updateReady != null && away >= 60) {
        _updateReady = null;
        _web.reload();
      } else {
        _checkUpdate();
      }
    }
    if (state == AppLifecycleState.paused) {
      _pausedAt = DateTime.now();
      Push.foreground(false);
    }
    if (state == AppLifecycleState.resumed) Push.foreground(true);
    if (state == AppLifecycleState.resumed && _training && _trainBuffer.isNotEmpty) {
      final from = _sentUpTo.clamp(0, _trainBuffer.length);
      final batch = _trainBuffer.sublist(from > 50 ? from - 50 : 0);
      _sentUpTo = _trainBuffer.length;
      _js('window.JG && JG._posBatch(${jsonEncode(batch)})');
    } else if (state == AppLifecycleState.paused) {
      _sentUpTo = _trainBuffer.length > 300 ? _trainBuffer.length - 300 : 0;
    }
  }

  /* ---------------- voz ---------------- */
  Future<void> _setupTts() async {
    try {
      await _tts.setLanguage('pt-BR');
      await _tts.setSpeechRate(0.5);
      await _tts.awaitSpeakCompletion(false);
    } catch (_) {}
  }

  /* ---------------- compartilhar / abrir links ---------------- */
  Future<bool> _shareFile(String name, String mime, String b64) async {
    try {
      final dir = await getTemporaryDirectory();
      final safe = name.replaceAll(RegExp(r'[^\w\-.]'), '_');
      final f = File('${dir.path}/$safe');
      await f.writeAsBytes(base64Decode(b64));
      await SharePlus.instance.share(ShareParams(files: [XFile(f.path, mimeType: mime)], text: 'Meu treino no JustGo'));
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _openExternal(String url) async {
    try {
      final uri = Uri.parse(url);
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  /* ---------------- links de volta do login (justgo://login-callback) ---------------- */
  Future<void> _setupLinks() async {
    try {
      final first = await _links.getInitialLink();
      if (first != null) _deliverLink(first.toString());
    } catch (_) {}
    _linkSub = _links.uriLinkStream.listen((u) => _deliverLink(u.toString()));
  }

  void _deliverLink(String url) {
    if (!url.startsWith('justgo://')) return;
    if (!_ready) {
      _pendingLink = url;
      return;
    }
    _js('window.Cloud && Cloud.handleAuthCallback(${jsonEncode(url)})');
  }

  /* ---------------- botão voltar ---------------- */
  Future<void> _onBack() async {
    String r = 'exit';
    try {
      final res = await _web.runJavaScriptReturningResult("window.JG ? JG.back() : 'exit'");
      r = res.toString().replaceAll('"', '');
    } catch (_) {}
    if (r == 'exit') {
      SystemNavigator.pop();
    } else if (r == 'training') {
      _js("window.FX && FX.toast('Treino em andamento. Use o botão Início do celular para minimizar.')");
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _onBack();
      },
      child: Scaffold(
        backgroundColor: _bg,
        body: SafeArea(child: WebViewWidget(controller: _web)),
      ),
    );
  }
}


/* ---------------- anúncio premiado (AdMob) ---------------- */
class Ads {
  static final Map<String, RewardedAd> _ads = {};
  static final Set<String> _loading = {};
  static String _err = '';
  static int _code = -1;
  static bool _cancel = false;
  static String _unit(String k) => Platform.isIOS ? kAdUnitIOS : (kAdUnits[k] ?? kAdUnits['xp']!);
  static void load(String k) {
    if (_loading.contains(k) || _ads[k] != null) return;
    _loading.add(k);
    RewardedAd.load(
      adUnitId: _unit(k),
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) { _ads[k] = ad; _loading.remove(k); _err = ''; _code = -1; _fails[k] = 0; },
        onAdFailedToLoad: (e) { _ads.remove(k); _loading.remove(k); _code = e.code; _err = e.message; _retry(k); },
      ),
    );
  }

  static void cancel() { _cancel = true; }

  // deixa os 4 anúncios carregados desde que o app abre (na hora do toque já estão prontos)
  static void preloadAll() { for (final k in kAdUnits.keys) { load(k); } }
  static final Map<String, int> _fails = {};
  static void _retry(String k) {
    final n = (_fails[k] = (_fails[k] ?? 0) + 1);
    final wait = Duration(seconds: n < 3 ? 30 : n < 6 ? 120 : 600); // tenta de novo com calma
    Future.delayed(wait, () => load(k));
  }
  // qualquer anúncio que já esteja pronto (de outra recompensa) serve
  static String? _ready(String k) { if (_ads[k] != null) return k; for (final x in _ads.keys) { return x; } return null; }

  static Future<Map<String, dynamic>> show(String k) async {
    if (!kAdUnits.containsKey(k)) k = 'xp';
    _cancel = false;
    var key = _ready(k);
    if (key == null) {
      // nenhum pronto: espera no máximo ~5 s (a pessoa não fica olhando para um carregando)
      _code = -1; _err = '';
      load(k);
      for (var i = 0; i < 10 && key == null && !_cancel; i++) {
        await Future.delayed(const Duration(milliseconds: 500));
        key = _ready(k);
      }
      if (_cancel) return {'ok': false, 'rewarded': false, 'error': 'cancel'};
      if (key == null) return {'ok': false, 'rewarded': false, 'error': 'noFill', 'code': _code, 'msg': _err};
    }
    if (_cancel) return {'ok': false, 'rewarded': false, 'error': 'cancel'};
    final String used = key!;
    final ad = _ads.remove(used)!;
    final done = Completer<Map<String, dynamic>>();
    var earned = false;
    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdDismissedFullScreenContent: (a) { a.dispose(); if (!done.isCompleted) done.complete({'ok': true, 'rewarded': earned}); load(used); },
      onAdFailedToShowFullScreenContent: (a, e) { a.dispose(); if (!done.isCompleted) done.complete({'ok': false, 'rewarded': false, 'error': 'show', 'code': e.code, 'msg': e.message}); load(used); },
    );
    ad.show(onUserEarnedReward: (a, r) { earned = true; });
    return done.future;
  }
}
