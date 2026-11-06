# Mantém o que o AdMob / WorkManager / Room precisam (sem isso o app fecha ao abrir)
-keep class androidx.work.** { *; }
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.room.** { *; }
-keep class com.google.android.gms.ads.** { *; }
-keep class io.flutter.plugins.googlemobileads.** { *; }
-dontwarn androidx.work.**
-dontwarn com.google.android.gms.**
