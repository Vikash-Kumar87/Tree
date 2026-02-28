"""
Biomass & Carbon Estimator
===========================
Implements the Chave et al. (2005) allometric equation for above-ground
dry biomass, with IPCC carbon and CO₂ conversion factors.

Reference:
  Chave, J. et al. (2005). Tree allometry and improved estimation of carbon
  stocks and balance in tropical forests. Oecologia, 145(1), 87–99.
  DOI: 10.1007/s00442-005-0100-x

Formula:
  AGB = ρ × exp(-1.499 + 2.148·ln(D) + 0.207·(ln(D))² - 0.0281·(ln(D))³)
  where D = trunk diameter at breast height (DBH) in cm.

Extended form with height:
  AGB = 0.0509 × ρ × D² × H
  where D in cm, H in m, ρ in g/cm³ → AGB in kg.
"""

from __future__ import annotations
import math
from app.config import settings


class BiomassEstimator:

    def estimate(self, height_m: float, diameter_cm: float) -> dict:
        """
        Compute above-ground biomass, carbon storage, and CO₂ sequestration.

        Args:
            height_m:     tree height in metres
            diameter_cm:  trunk diameter at breast height in centimetres

        Returns:
            {biomass_kg, carbon_kg, co2_kg, formula_used}
        """
        rho = settings.WOOD_DENSITY_G_CM3  # g/cm³

        # Method 1: Chave height-diameter allometry (preferred when height known)
        if height_m > 0 and diameter_cm > 0:
            biomass_kg = 0.0509 * rho * (diameter_cm ** 2) * height_m
            formula = "Chave_2005_height_diameter"
        elif diameter_cm > 0:
            # Method 2: Diameter-only Chave equation
            ln_d   = math.log(diameter_cm)
            biomass_kg = rho * math.exp(
                -1.499
                + 2.148 * ln_d
                + 0.207 * ln_d ** 2
                - 0.0281 * ln_d ** 3
            )
            formula = "Chave_2005_diameter_only"
        else:
            biomass_kg = 0.0
            formula = "no_data"

        carbon_kg = biomass_kg * settings.BIOMASS_TO_CARBON
        co2_kg    = carbon_kg  * settings.CARBON_TO_CO2

        return {
            "biomass_kg": round(biomass_kg, 3),
            "carbon_kg":  round(carbon_kg,  3),
            "co2_kg":     round(co2_kg,     3),
            "formula_used": formula,
        }
