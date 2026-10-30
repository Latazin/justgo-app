// JustGo — app Android (Flutter)
//
// O app roda a interface do JustGo (assets/web) num servidor local e
// num WebView, e cuida nativamente do que o navegador não faz bem:
//   • GPS em segundo plano com notificação fixa durante o treino
//   • tela sempre acesa, voz do treinador, compartilhar arquivos
//   • login com Google pelo navegador + retorno por link (justgo://)
//   • escolher arquivos (GPX, backup) e o botão "voltar" do Android
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:app_links/app_links.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:geolocator/geolocator.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

const kBg = Color(0xFF0A0A0B);
const kPort = 47621; // porta fixa: mantém os dados salvos entre aberturas

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: kBg,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: kBg,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
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
  };

  static Future<void> _handle(HttpRequest req) async {
    var path = Uri.decodeComponent(req.uri.path);
    if (path == '/' || path.isEmpty) path = '/index.html';
    try {
      final data = await rootBundle.load('assets/web$path');
      final ext = path.split('.').last.toLowerCase();
      req.response.headers.set('Content-Type', _types[ext] ?? 'application/octet-stream');
      req.response.headers.set('Cache-Control', 'no-cache');
      req.response.add(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes));
    } catch (_) {
      req.response.statusCode = HttpStatus.notFound;
    }
    await req.response.close();
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
      theme: ThemeData(brightness: Brightness.dark, scaffoldBackgroundColor: kBg, colorSchemeSeed: const Color(0xFFFC4A00)),
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
  final List<Map<String, dynamic>> _trainBuffer = []; // pontos do treino (reenviados ao voltar)
  int _sentUpTo = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _setupWebView();
    _setupTts();
    _setupLinks();
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
    final c = WebViewController.fromPlatformCreationParams(const PlatformWebViewControllerCreationParams());
    c
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(kBg)
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
        if (await _ensurePermission()) await _startStream(restart: true);
        _reply(id, {'ok': true});
        break;
      case 'trainStop':
        _training = false;
        _trainBuffer.clear();
        WakelockPlus.disable();
        await _startStream(restart: true); // volta ao modo normal (sem notificação)
        if (!_watching) await _stopStream();
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
      case 'open':
        _openExternal('${m['url']}');
        _reply(id, {'ok': true});
        break;
      default:
        _reply(id, null);
    }
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
    final settings = AndroidSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: 0,
      intervalDuration: const Duration(seconds: 1),
      // durante o treino: serviço em primeiro plano = GPS continua com o app minimizado
      foregroundNotificationConfig: _training
          ? const ForegroundNotificationConfig(
              notificationTitle: 'JustGo · treino em andamento',
              notificationText: 'Gravando seu percurso. Toque para voltar ao app.',
              notificationIcon: AndroidResource(name: 'ic_launcher', defType: 'mipmap'),
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
        backgroundColor: kBg,
        body: SafeArea(child: WebViewWidget(controller: _web)),
      ),
    );
  }
}
