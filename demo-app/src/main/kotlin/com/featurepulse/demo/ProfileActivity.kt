// demo-app/src/main/kotlin/com/featurepulse/demo/ProfileActivity.kt
package com.featurepulse.demo

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.featurepulse.demo.databinding.ActivityProfileBinding

class ProfileActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val binding = ActivityProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "My Profile"
        binding.btnEditProfile.setOnClickListener  { Toast.makeText(this, "Edit…", Toast.LENGTH_SHORT).show() }
        binding.btnOrderHistory.setOnClickListener { Toast.makeText(this, "Orders…", Toast.LENGTH_SHORT).show() }
        binding.btnConnectFacebook.setOnClickListener { /* intentionally dead */ }
    }
}
