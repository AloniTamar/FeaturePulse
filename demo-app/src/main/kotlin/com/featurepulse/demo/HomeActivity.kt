// demo-app/src/main/kotlin/com/featurepulse/demo/HomeActivity.kt
package com.featurepulse.demo

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.featurepulse.demo.databinding.ActivityHomeBinding

class HomeActivity : AppCompatActivity() {
    private lateinit var binding: ActivityHomeBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "ShopDemo — Home"

        binding.btnBrowseProducts.setOnClickListener {
            supportFragmentManager.beginTransaction()
                .replace(binding.fragmentContainer.id, ProductFragment())
                .addToBackStack(null)
                .commit()
        }
        binding.btnViewProfile.setOnClickListener {
            startActivity(Intent(this, ProfileActivity::class.java))
        }
        binding.btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        // Dead buttons: wired to no-op listeners — intentionally never triggered
        binding.btnSummerPromo.setOnClickListener { /* intentionally dead */ }
        binding.btnShareApp.setOnClickListener   { /* intentionally dead */ }
    }
}
