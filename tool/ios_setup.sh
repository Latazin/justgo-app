#!/bin/bash
# Ajusta o projeto iOS gerado pelo "flutter create": permissões, GPS em segundo plano,
# servidor local (127.0.0.1), link de volta do login e nome do app.
set -e
P=ios/Runner/Info.plist
pb() { /usr/libexec/PlistBuddy -c "$1" "$P" 2>/dev/null || true; }
pb "Set :CFBundleDisplayName JustGo"
pb "Add :CFBundleDisplayName string JustGo"
pb "Add :NSLocationWhenInUseUsageDescription string O JustGo usa sua localização para gravar o percurso dos treinos e mostrar o mapa."
pb "Add :NSLocationAlwaysAndWhenInUseUsageDescription string Para continuar gravando o treino com a tela bloqueada, o JustGo usa sua localização em segundo plano."
pb "Add :NSLocationAlwaysUsageDescription string Para continuar gravando o treino com a tela bloqueada, o JustGo usa sua localização em segundo plano."
pb "Add :NSCameraUsageDescription string Para tirar fotos dos seus treinos."
pb "Add :NSPhotoLibraryUsageDescription string Para escolher fotos de perfil e dos treinos."
pb "Add :NSPhotoLibraryAddUsageDescription string Para salvar imagens e vídeos dos seus treinos."
pb "Add :UIBackgroundModes array"
pb "Add :UIBackgroundModes:0 string location"
pb "Add :UIBackgroundModes:1 string audio"
pb "Add :NSAppTransportSecurity dict"
pb "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true"
pb "Add :NSAppTransportSecurity:NSAllowsArbitraryLoadsInWebContent bool true"
pb "Add :CFBundleURLTypes array"
pb "Add :CFBundleURLTypes:0 dict"
pb "Add :CFBundleURLTypes:0:CFBundleURLName string com.justgo.login"
pb "Add :CFBundleURLTypes:0:CFBundleURLSchemes array"
pb "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string justgo"
pb "Add :LSApplicationQueriesSchemes array"
pb "Add :LSApplicationQueriesSchemes:0 string https"
pb "Add :LSApplicationQueriesSchemes:1 string tel"
pb "Add :UIFileSharingEnabled bool true"
pb "Add :LSSupportsOpeningDocumentsInPlace bool true"
pb "Add :ITSAppUsesNonExemptEncryption bool false"
# AdMob (anúncio premiado): ID de TESTE do Google para iOS (trocar pelo app iOS do seu AdMob)
pb "Add :GADApplicationIdentifier string ca-app-pub-3940256099942544~1458002511"
pb "Add :SKAdNetworkItems array"
pb "Add :SKAdNetworkItems:0 dict"
pb "Add :SKAdNetworkItems:0:SKAdNetworkIdentifier string cstr6suwn9.skadnetwork"
# só retrato (como no Android)
pb "Delete :UISupportedInterfaceOrientations"
pb "Add :UISupportedInterfaceOrientations array"
pb "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait"
/usr/libexec/PlistBuddy -c "Print" "$P"
# iOS mínimo 13
if [ -f ios/Podfile ]; then sed -i '' "s/^# platform :ios.*/platform :ios, '13.0'/" ios/Podfile; fi
