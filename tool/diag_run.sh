set -x
P=br.com.justgo.app
adb install -r app.apk
adb shell pm grant $P android.permission.ACCESS_FINE_LOCATION
adb shell pm grant $P android.permission.ACCESS_COARSE_LOCATION
adb shell appops set $P android:mock_location allow || true
adb emu geo fix -46.6333 -23.5505
adb shell monkey -p $P -c android.intent.category.LAUNCHER 1
sleep 30
adb exec-out screencap -p > 01-aberto.png
PID=$(adb shell pidof $P | tr -d '\r')
SOCK=$(adb shell cat /proc/net/unix | grep -o "webview_devtools_remote_[0-9]*" | head -1)
echo "pid=$PID sock=$SOCK"
adb forward tcp:9222 localabstract:$SOCK
J() { python3 tool/diag_cdp.py "$1"; }
curl -s localhost:9222/json | head -30
J "JSON.stringify({ver: CONFIG.version, native: Native.on})"
J "Store.data.profile.onboarded=true; Store.save(); 'ok'"
echo "=== estado sem permissao"
J "Native.call('notifState',{},8000).then(r=>JSON.stringify(r))"
adb shell pm grant $P android.permission.POST_NOTIFICATIONS
J "Native.call('notifState',{},8000).then(r=>JSON.stringify(r))"
echo "=== teste"
J "Native.call('notifTest',{title:'Tudo certo!',body:'teste'},8000).then(r=>JSON.stringify(r))"
sleep 3
adb shell dumpsys notification --noredact | grep -E "pkg=$P|android.title|android.text|channel=" | head -40
echo "=== treino"
J "App.go('record'); Store.data.profile.countdown=false; App.startTraining().then(()=>'started')"
for i in $(seq 1 12); do adb emu geo fix -46.6333 $(python3 -c "print(-23.5505+$i*0.0002)"); sleep 2; done
J "JSON.stringify({st: App.tracker && App.tracker.state, d: App.tracker && App.tracker.distance})"
sleep 6
adb shell dumpsys notification --noredact | grep -E "pkg=$P|android.title|android.text|android.subText|channel=|id=75415" | head -60
adb exec-out screencap -p > 02-treino.png
adb shell cmd statusbar expand-notifications; sleep 2
adb exec-out screencap -p > 03-gaveta.png
adb shell cmd statusbar collapse
echo "=== tela de bloqueio"
adb shell input keyevent 26; sleep 3; adb shell input keyevent 224; sleep 3
adb exec-out screencap -p > 04-bloqueio.png
adb shell dumpsys notification --noredact | grep -E "id=75415" | cut -c1-250
adb shell input keyevent 82; sleep 1
echo "=== pausa"
J "App.actions.pause(); 'p'"
sleep 4
adb shell dumpsys notification --noredact | grep -E "android.title|android.text" | head -10
echo "=== workmanager"
adb shell dumpsys jobscheduler | grep -i "$P" | head -10
adb logcat -d | grep -iE "flutter|notif|workmanager|FATAL" | tail -80 > logcat.txt
