// JustGo — widget da tela inicial e treinos do relógio (Health Connect)
import 'package:health/health.dart';
import 'package:home_widget/home_widget.dart';

// ---------------- widget: km da semana e ofensiva ----------------
class JgWidget {
  static const name = 'com.justgo.justgo.JustGoWidget';
  static Future<Map<String, dynamic>> update(Map m) async {
    try {
      for (final k in ['km', 'goal', 'pct', 'streak', 'days']) {
        await HomeWidget.saveWidgetData<String>(k, '${m[k] ?? ''}');
      }
      await HomeWidget.updateWidget(qualifiedAndroidName: name);
      return {'ok': true};
    } catch (e) {
      return {'ok': false, 'error': '$e'};
    }
  }
}

// ---------------- Health Connect: lê treinos de relógios e apps de saúde ----------------
class Hc {
  static final _h = Health();
  static bool _cfg = false;
  static const _types = [HealthDataType.WORKOUT, HealthDataType.DISTANCE_DELTA, HealthDataType.TOTAL_CALORIES_BURNED];

  static Future<void> _init() async {
    if (_cfg) return;
    await _h.configure();
    _cfg = true;
  }

  static Future<Map<String, dynamic>> state() async {
    try {
      await _init();
      final st = await _h.getHealthConnectSdkStatus();
      final ok = st == HealthConnectSdkStatus.sdkAvailable;
      bool granted = false;
      if (ok) granted = (await _h.hasPermissions(_types, permissions: _types.map((_) => HealthDataAccess.READ).toList())) == true;
      return {'available': ok, 'needsInstall': st == HealthConnectSdkStatus.sdkUnavailableProviderUpdateRequired, 'granted': granted};
    } catch (e) {
      return {'available': false, 'error': '$e'};
    }
  }

  static Future<Map<String, dynamic>> ask() async {
    try {
      await _init();
      final st = await _h.getHealthConnectSdkStatus();
      if (st != HealthConnectSdkStatus.sdkAvailable) {
        await _h.installHealthConnect();
        return {'ok': false, 'install': true};
      }
      final ok = await _h.requestAuthorization(_types, permissions: _types.map((_) => HealthDataAccess.READ).toList());
      return {'ok': ok};
    } catch (e) {
      return {'ok': false, 'error': '$e'};
    }
  }

  static Future<Map<String, dynamic>> read(int days) async {
    try {
      await _init();
      final now = DateTime.now();
      final pts = await _h.getHealthDataFromTypes(types: [HealthDataType.WORKOUT], startTime: now.subtract(Duration(days: days)), endTime: now);
      final out = <Map<String, dynamic>>[];
      for (final p in pts) {
        final v = p.value;
        if (v is! WorkoutHealthValue) continue;
        out.add({
          'id': p.uuid,
          'type': v.workoutActivityType.name,
          'from': p.dateFrom.millisecondsSinceEpoch,
          'to': p.dateTo.millisecondsSinceEpoch,
          'dist': v.totalDistance,
          'kcal': v.totalEnergyBurned,
          'src': p.sourceName,
        });
      }
      return {'ok': true, 'list': out};
    } catch (e) {
      return {'ok': false, 'error': '$e'};
    }
  }
}
