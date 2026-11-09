# Mantém o que o AdMob / WorkManager / Room precisam (sem isso o app fecha ao abrir)
-keep class androidx.work.** { *; }
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.room.** { *; }
-keep class com.google.android.gms.ads.** { *; }
-keep class io.flutter.plugins.googlemobileads.** { *; }
-dontwarn androidx.work.**
-dontwarn com.google.android.gms.**
# notificações (flutter_local_notifications usa Gson) e tarefas em segundo plano
-keep class com.dexterous.** { *; }
-keep class com.google.gson.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
-keep class dev.fluttercommunity.workmanager.** { *; }
-dontwarn com.dexterous.**
# compras na Google Play
-keep class com.android.billingclient.** { *; }
-keep class io.flutter.plugins.inapppurchase.** { *; }
