# fonte do AltStore/SideStore: o app aparece na loja e atualiza por lá
import json, sys, datetime
repo, ver, size = sys.argv[1], sys.argv[2], int(sys.argv[3])
bid = sys.argv[4] if len(sys.argv) > 4 else 'com.justgo.justgo'
raw = f'https://raw.githubusercontent.com/{repo}/build-output-ios'
today = datetime.date.today().isoformat()
print(json.dumps({
  "name": "JustGo", "identifier": "com.justgo.source", "subtitle": "Corrida, pedal e natação com território",
  "iconURL": f"{raw}/icon.png", "tintColor": "#1F6BFF",
  "apps": [{
    "name": "JustGo", "bundleIdentifier": bid, "developerName": "JustGo",
    "subtitle": "Domine sua cidade", "localizedDescription": "Grave corridas, pedais e natação com GPS, conquiste territórios no mapa, desafie os amigos e reviva seus treinos em 3D.",
    "iconURL": f"{raw}/icon.png", "tintColor": "#1F6BFF", "category": "lifestyle",
    "versions": [{"version": ver, "date": today, "localizedDescription": "Nova versão do JustGo.", "downloadURL": f"{raw}/JustGo.ipa", "size": size, "minOSVersion": "13.0"}],
    "appPermissions": {"entitlements": [], "privacy": {
      "NSLocationWhenInUseUsageDescription": "Gravar o percurso dos treinos.",
      "NSLocationAlwaysAndWhenInUseUsageDescription": "Continuar gravando com a tela bloqueada.",
      "NSCameraUsageDescription": "Fotos dos treinos.", "NSPhotoLibraryUsageDescription": "Fotos de perfil e dos treinos."}}
  }],
  "news": []
}, ensure_ascii=False, indent=2))
