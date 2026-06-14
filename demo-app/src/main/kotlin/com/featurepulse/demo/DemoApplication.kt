// demo-app/src/main/kotlin/com/featurepulse/demo/DemoApplication.kt
package com.featurepulse.demo

import android.app.Application
import com.featurepulse.FeaturePulse
import com.featurepulse.PulseConfig
import java.util.concurrent.TimeUnit

class DemoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FeaturePulse.init(
            this,
            PulseConfig.Builder()
                .setApiKey(BuildConfig.FP_API_KEY.ifBlank { "REPLACE_ME" })
                .setAppId(BuildConfig.FP_APP_ID.ifBlank { packageName })
                .setServerUrl("https://featurepulse.up.railway.app")
                .setBatchSize(50)
                .setSyncInterval(1, TimeUnit.MINUTES)
                .build()
        )
    }
}
