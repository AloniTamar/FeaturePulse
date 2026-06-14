// demo-app/src/main/kotlin/com/featurepulse/demo/SettingsActivity.kt
package com.featurepulse.demo

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.featurepulse.FeaturePulse
import com.featurepulse.demo.databinding.ActivitySettingsBinding

class SettingsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "Settings"
        binding.btnNotifications.setOnClickListener { Toast.makeText(this, "Notifications…", Toast.LENGTH_SHORT).show() }
        binding.btnJoinBeta.setOnClickListener      { /* intentionally dead */ }
        binding.btnFlushSdk.setOnClickListener      {
            FeaturePulse.flush()
            Toast.makeText(this, "SDK flushed", Toast.LENGTH_SHORT).show()
        }
    }
}
