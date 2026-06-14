// demo-app/src/main/kotlin/com/featurepulse/demo/ProductFragment.kt
package com.featurepulse.demo

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.featurepulse.demo.databinding.FragmentProductBinding

class ProductFragment : Fragment() {
    private var _binding: FragmentProductBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, state: Bundle?): View {
        _binding = FragmentProductBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.btnAddToCart.setOnClickListener { Toast.makeText(context, "Added!", Toast.LENGTH_SHORT).show() }
        binding.btnBuyNow.setOnClickListener    { Toast.makeText(context, "Purchasing…", Toast.LENGTH_SHORT).show() }
        binding.btnViewAr.setOnClickListener   { /* intentionally dead */ }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
