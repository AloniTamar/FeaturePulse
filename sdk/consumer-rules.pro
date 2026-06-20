# FeaturePulse SDK consumer rules
-keep class io.featurepulse.sdk.** { *; }
-keepclassmembers class io.featurepulse.sdk.** { *; }
-dontwarn io.featurepulse.sdk.**

# OkHttp (transitive dependency)
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# WorkManager (transitive dependency)
-keep class androidx.work.** { *; }
-keepclassmembers class androidx.work.** { *; }
