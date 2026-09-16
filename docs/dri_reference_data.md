# US/Canada Dietary Reference Intakes (DRI) — Backend Reference Data

Source: Food and Nutrition Board, National Academies of Sciences, Engineering, and Medicine (NASEM), cross-referenced with NIH Office of Dietary Supplements. Values are RDA (Recommended Dietary Allowance) unless marked AI (Adequate Intake — used when no RDA has been established) or UL (Tolerable Upper Intake Level, i.e. a safe ceiling, not a target). All values are per day for healthy individuals.

This is structured for use as lookup tables in an app backend (e.g. keyed by nutrient → life-stage group → value). A JSON-shaped version follows the prose tables so you can adapt it directly.

---

## 1. Life Stage / Age-Sex Groups Used Throughout

- Infants: 0–6 mo, 7–12 mo
- Children: 1–3 y, 4–8 y
- Males: 9–13 y, 14–18 y, 19–30 y, 31–50 y, 51–70 y, 70+ y
- Females: 9–13 y, 14–18 y, 19–30 y, 31–50 y, 51–70 y, 70+ y
- Pregnancy: ≤18 y, 19–30 y, 31–50 y
- Lactation: ≤18 y, 19–30 y, 31–50 y

---

## 2. Macronutrients

### Total Water (AI, L/day, includes water from food+beverages)
| Group | Total Water |
|---|---|
| 0–6 mo | 0.7 L |
| 7–12 mo | 0.8 L |
| 1–3 y | 1.3 L |
| 4–8 y | 1.7 L |
| Males 9–13 | 2.4 L |
| Males 14–18 | 3.3 L |
| Males 19+ | 3.7 L |
| Females 9–13 | 2.1 L |
| Females 14–18 | 2.3 L |
| Females 19+ | 2.7 L |
| Pregnancy | 3.0 L |
| Lactation | 3.8 L |

### Carbohydrate (RDA)
| Group | g/day |
|---|---|
| Infants (AI) | 60 g (0–6mo) / 95 g (7–12mo) |
| Children 1–18 & Adults | 130 g |
| Pregnancy | 175 g |
| Lactation | 210 g |

### Total Fiber (AI)
| Group | g/day |
|---|---|
| 1–3 y | 19 g |
| 4–8 y | 25 g |
| Males 9–13 | 31 g |
| Males 14–50 | 38 g |
| Males 51+ | 30 g |
| Females 9–13 | 26 g |
| Females 14–50 | 25 g |
| Females 51+ | 21 g |
| Pregnancy | 28 g |
| Lactation | 29 g |

### Fat & Fatty Acids
- Total fat: no RDA/AI for adults (AMDR 20–35% of calories); infants 0–6mo AI = 31 g/day, 7–12mo AI = 30 g/day
- Linoleic acid (omega-6, AI): Males 19+ 17 g; Males 50+ 14g; Females 19-50 12 g; Females 50+ 11g; Pregnancy 13 g; Lactation 13 g
- Alpha-linolenic acid (omega-3, AI): Males 1.6 g; Females 1.1 g; Pregnancy 1.4 g; Lactation 1.3 g
- Saturated fat, trans fat, added sugar, dietary cholesterol: no established RDA/AI/UL — Dietary Guidelines advise minimizing (see Section 6 below)

### Protein (RDA)
| Group | g/day | g/kg body weight |
|---|---|---|
| 0–6 mo (AI) | 9.1 g | 1.52 |
| 7–12 mo | 11 g | 1.2 |
| 1–3 y | 13 g | 1.05 |
| 4–8 y | 19 g | 0.95 |
| 9–13 y | 34 g | 0.95 |
| Males 14–18 | 52 g | 0.85 |
| Females 14–18 | 46 g | 0.85 |
| Adults 19+ | 56 g (M) / 46 g (F) | 0.8 |
| Pregnancy | +25 g (≈71 g total) | 1.1 |
| Lactation | +25 g (≈71 g total) | 1.3 |

### Acceptable Macronutrient Distribution Ranges (AMDR, % of calories) — Adults
- Carbohydrate: 45–65%
- Fat: 20–35%
- Protein: 10–35%
- Linoleic acid: 5–10%
- Alpha-linolenic acid: 0.6–1.2%

---

## 3. Major Minerals (Electrolytes/Macrominerals)

### Sodium (AI / CDRR = Chronic Disease Risk Reduction intake, the practical upper target)
| Group | AI | CDRR (upper target) |
|---|---|---|
| 1–3 y | 800 mg | 1,200 mg |
| 4–8 y | 1,000 mg | 1,500 mg |
| 9–13 y | 1,200 mg | 1,800 mg |
| 14–18 y | 1,500 mg | 2,300 mg |
| Adults 19–50 | 1,500 mg | 2,300 mg |
| Adults 51–70 | 1,300 mg | 2,300 mg |
| Adults 70+ | 1,200 mg | 2,300 mg |
| Pregnancy/Lactation | 1,500 mg | 2,300 mg |

### Potassium (AI)
| Group | mg/day |
|---|---|
| 1–3 y | 2,000 mg |
| 4–8 y | 2,300 mg |
| 9–13 y | 2,500 (F) / 2,300 (M) mg |
| 14–18 y | 2,300 (F) / 3,000 (M) mg |
| Adults 19+ | 2,600 (F) / 3,400 (M) mg |
| Pregnancy | 2,600–2,900 mg |
| Lactation | 2,500–2,800 mg |

### Chloride (AI)
| Group | mg/day |
|---|---|
| 1–3 y | 1,200 mg |
| 4–8 y | 1,500 mg |
| 9–13 y | 1,800 mg |
| 14–50 y | 2,300 mg |
| 51–70 y | 2,000 mg |
| 70+ y | 1,800 mg |

### Calcium (RDA)
| Group | mg/day | UL |
|---|---|---|
| 1–3 y | 700 mg | 2,500 |
| 4–8 y | 1,000 mg | 2,500 |
| 9–18 y | 1,300 mg | 3,000 |
| 19–50 y | 1,000 mg | 2,500 |
| Males 51–70 | 1,000 mg | 2,000 |
| Females 51–70 | 1,200 mg | 2,000 |
| 70+ y | 1,200 mg | 2,000 |
| Pregnancy/Lactation ≤18 | 1,300 mg | 3,000 |
| Pregnancy/Lactation 19+ | 1,000 mg | 2,500 |

### Phosphorus (RDA)
| Group | mg/day |
|---|---|
| 1–3 y | 460 mg |
| 4–8 y | 500 mg |
| 9–18 y | 1,250 mg |
| 19+ y | 700 mg |
| Pregnancy/Lactation | 700 mg (1,250 if ≤18) |

### Magnesium (RDA)
| Group | mg/day |
|---|---|
| 1–3 y | 80 mg |
| 4–8 y | 130 mg |
| 9–13 y | 240 mg |
| Males 14–18 | 410 mg |
| Females 14–18 | 360 mg |
| Males 19–30 | 400 mg |
| Males 31+ | 420 mg |
| Females 19–30 | 310 mg |
| Females 31+ | 320 mg |
| Pregnancy | 350–400 mg |
| Lactation | 310–360 mg |

---

## 4. Trace Minerals

| Nutrient | Children 1-8 | 9-13y | 14-18y M/F | Adults 19-50 M/F | Adults 51+ M/F | Pregnancy | Lactation | UL (adult) |
|---|---|---|---|---|---|---|---|---|
| Iron (mg) | 7 / 10 | 8 | 11 / 15 | 8 / 18 | 8 / 8 | 27 | 9–10 | 45 mg |
| Zinc (mg) | 3 / 5 | 8 | 11 / 9 | 11 / 8 | 11 / 8 | 11–12 | 12–13 | 40 mg |
| Copper (mcg) | 340 / 440 | 700 | 890 | 900 | 900 | 1,000 | 1,300 | 10,000 mcg |
| Manganese (mg, AI) | 1.2 / 1.5 | 1.6/1.6 | 2.2/1.6 | 2.3/1.8 | 2.3/1.8 | 2.0 | 2.6 | 11 mg |
| Selenium (mcg) | 20 / 30 | 40 | 55 | 55 | 55 | 60 | 70 | 400 mcg |
| Iodine (mcg) | 90 / 90 | 120 | 150 | 150 | 150 | 220 | 290 | 1,100 mcg |
| Chromium (mcg, AI) | 11/15 | 25/21 | 35/24 | 35/25 | 30/20 | 30 | 44–45 | not set |
| Molybdenum (mcg) | 17/22 | 34 | 43 | 45 | 45 | 50 | 50 | 2,000 mcg |
| Fluoride (mg, AI) | 0.7/1.0 | 2 | 3 | 4 (M) / 3 (F) | same | 3 | 3 | 10 mg |

---

## 5. Vitamins

### Fat-Soluble

| Nutrient | Children 1-8 | 9-13y | 14-18y M/F | Adults 19-50 M/F | Adults 51+ M/F | Pregnancy | Lactation | UL (adult) |
|---|---|---|---|---|---|---|---|---|
| Vitamin A (mcg RAE) | 300/400 | 600 | 900/700 | 900/700 | 900/700 | 750–770 | 1,200–1,300 | 3,000 mcg |
| Vitamin D (mcg) | 15 | 15 | 15 | 15 | 15 (51-70) / 20 (70+) | 15 | 15 | 100 mcg |
| Vitamin E (mg) | 6/7 | 11 | 15 | 15 | 15 | 15 | 19 | 1,000 mg |
| Vitamin K (mcg, AI) | 30/55 | 60 | 75/75 | 120 (M) / 90 (F) | same | 90 | 90 | not set |

### Water-Soluble

| Nutrient | Children 1-8 | 9-13y | 14-18y M/F | Adults 19-50 M/F | Adults 51+ M/F | Pregnancy | Lactation | UL (adult) |
|---|---|---|---|---|---|---|---|---|
| Vitamin C (mg) | 15/25 | 45 | 75/65 | 90/75 | 90/75 | 85 | 120 | 2,000 mg |
| Thiamin B1 (mg) | 0.5/0.6 | 0.9 | 1.2/1.0 | 1.2/1.1 | 1.2/1.1 | 1.4 | 1.4 | not set |
| Riboflavin B2 (mg) | 0.5/0.6 | 0.9 | 1.3/1.0 | 1.3/1.1 | 1.3/1.1 | 1.4 | 1.6 | not set |
| Niacin B3 (mg NE) | 6/8 | 12 | 16/14 | 16/14 | 16/14 | 18 | 17 | 35 mg |
| Vitamin B6 (mg) | 0.5/0.6 | 1.0 | 1.3 | 1.3 | 1.7 (M)/1.5 (F) | 1.9 | 2.0 | 100 mg |
| Folate (mcg DFE) | 150/200 | 300 | 400 | 400 | 400 | 600 | 500 | 1,000 mcg |
| Vitamin B12 (mcg) | 0.9/1.2 | 1.8 | 2.4 | 2.4 | 2.4 | 2.6 | 2.8 | not set |
| Pantothenic Acid B5 (mg, AI) | 2/3 | 4 | 5 | 5 | 5 | 6 | 7 | not set |
| Biotin B7 (mcg, AI) | 8/12 | 20 | 25 | 30 | 30 | 30 | 35 | not set |
| Choline (mg, AI) | 200/250 | 375 | 550/400 | 550/425 | 550/425 | 450 | 550 | 3,500 mg |

---

## 6. Nutrients with Guideline (Not DRI) Targets

These come from the Dietary Guidelines for Americans / AHA rather than the formal DRI process, since no RDA/AI has been established:

| Nutrient | Guideline |
|---|---|
| Added sugar | <10% of total daily calories |
| Saturated fat | <10% of total daily calories |
| Trans fat | As low as possible |
| Dietary cholesterol | No specific limit in current guidelines; minimize as part of overall pattern |
| Sodium (practical upper target) | See CDRR in Section 3 (2,300 mg for most adults/teens) |

---

## 7. JSON Structure for Backend Use

```json
{
  "life_stage_groups": [
    "infant_0_6mo", "infant_7_12mo", "child_1_3y", "child_4_8y",
    "male_9_13y", "male_14_18y", "male_19_30y", "male_31_50y", "male_51_70y", "male_70plus",
    "female_9_13y", "female_14_18y", "female_19_30y", "female_31_50y", "female_51_70y", "female_70plus",
    "pregnancy_under18", "pregnancy_19_30", "pregnancy_31_50",
    "lactation_under18", "lactation_19_30", "lactation_31_50"
  ],
  "nutrients": {
    "fiber_g": {
      "type": "AI",
      "unit": "g",
      "values": {
        "child_1_3y": 19, "child_4_8y": 25,
        "male_9_13y": 31, "male_14_18y": 38, "male_19_30y": 38, "male_31_50y": 38, "male_51_70y": 30, "male_70plus": 30,
        "female_9_13y": 26, "female_14_18y": 25, "female_19_30y": 25, "female_31_50y": 25, "female_51_70y": 21, "female_70plus": 21,
        "pregnancy_under18": 28, "pregnancy_19_30": 28, "pregnancy_31_50": 28,
        "lactation_under18": 29, "lactation_19_30": 29, "lactation_31_50": 29
      }
    },
    "sodium_mg": {
      "type": "AI_and_CDRR",
      "unit": "mg",
      "ai_values": {
        "child_1_3y": 800, "child_4_8y": 1000,
        "male_9_13y": 1200, "male_14_18y": 1500, "male_19_30y": 1500, "male_31_50y": 1500, "male_51_70y": 1300, "male_70plus": 1200,
        "female_9_13y": 1200, "female_14_18y": 1500, "female_19_30y": 1500, "female_31_50y": 1500, "female_51_70y": 1300, "female_70plus": 1200,
        "pregnancy_under18": 1500, "pregnancy_19_30": 1500, "pregnancy_31_50": 1500,
        "lactation_under18": 1500, "lactation_19_30": 1500, "lactation_31_50": 1500
      },
      "cdrr_upper_target": {
        "child_1_3y": 1200, "child_4_8y": 1500,
        "male_9_13y": 1800, "male_14_18y": 2300, "male_19_30y": 2300, "male_31_50y": 2300, "male_51_70y": 2300, "male_70plus": 2300,
        "female_9_13y": 1800, "female_14_18y": 2300, "female_19_30y": 2300, "female_31_50y": 2300, "female_51_70y": 2300, "female_70plus": 2300,
        "pregnancy_under18": 2300, "pregnancy_19_30": 2300, "pregnancy_31_50": 2300,
        "lactation_under18": 2300, "lactation_19_30": 2300, "lactation_31_50": 2300
      }
    },
    "added_sugar_pct_calories": {
      "type": "guideline_not_DRI",
      "unit": "% of total daily calories",
      "value": 10,
      "note": "Applies to all groups >2y; no DRI established. AHA suggests stricter absolute caps: 25g/day women, 36g/day men."
    },
    "protein_g": {
      "type": "RDA",
      "unit": "g",
      "values": {
        "child_1_3y": 13, "child_4_8y": 19,
        "male_9_13y": 34, "male_14_18y": 52, "male_19_30y": 56, "male_31_50y": 56, "male_51_70y": 56, "male_70plus": 56,
        "female_9_13y": 34, "female_14_18y": 46, "female_19_30y": 46, "female_31_50y": 46, "female_51_70y": 46, "female_70plus": 46,
        "pregnancy_under18": 71, "pregnancy_19_30": 71, "pregnancy_31_50": 71,
        "lactation_under18": 71, "lactation_19_30": 71, "lactation_31_50": 71
      }
    },
    "carbohydrate_g": {
      "type": "RDA",
      "unit": "g",
      "values": {
        "child_1_3y": 130, "child_4_8y": 130,
        "male_9_13y": 130, "male_14_18y": 130, "male_19_30y": 130, "male_31_50y": 130, "male_51_70y": 130, "male_70plus": 130,
        "female_9_13y": 130, "female_14_18y": 130, "female_19_30y": 130, "female_31_50y": 130, "female_51_70y": 130, "female_70plus": 130,
        "pregnancy_under18": 175, "pregnancy_19_30": 175, "pregnancy_31_50": 175,
        "lactation_under18": 210, "lactation_19_30": 210, "lactation_31_50": 210
      }
    },
    "calcium_mg": {
      "type": "RDA",
      "unit": "mg",
      "values": {
        "child_1_3y": 700, "child_4_8y": 1000,
        "male_9_13y": 1300, "male_14_18y": 1300, "male_19_30y": 1000, "male_31_50y": 1000, "male_51_70y": 1000, "male_70plus": 1200,
        "female_9_13y": 1300, "female_14_18y": 1300, "female_19_30y": 1000, "female_31_50y": 1000, "female_51_70y": 1200, "female_70plus": 1200,
        "pregnancy_under18": 1300, "pregnancy_19_30": 1000, "pregnancy_31_50": 1000,
        "lactation_under18": 1300, "lactation_19_30": 1000, "lactation_31_50": 1000
      }
    },
    "potassium_mg": {
      "type": "AI",
      "unit": "mg",
      "values": {
        "child_1_3y": 2000, "child_4_8y": 2300,
        "male_9_13y": 2300, "male_14_18y": 3000, "male_19_30y": 3400, "male_31_50y": 3400, "male_51_70y": 3400, "male_70plus": 3400,
        "female_9_13y": 2500, "female_14_18y": 2300, "female_19_30y": 2600, "female_31_50y": 2600, "female_51_70y": 2600, "female_70plus": 2600,
        "pregnancy_under18": 2600, "pregnancy_19_30": 2900, "pregnancy_31_50": 2900,
        "lactation_under18": 2500, "lactation_19_30": 2800, "lactation_31_50": 2800
      }
    },
    "iron_mg": {
      "type": "RDA",
      "unit": "mg",
      "values": {
        "child_1_3y": 7, "child_4_8y": 10,
        "male_9_13y": 8, "male_14_18y": 11, "male_19_30y": 8, "male_31_50y": 8, "male_51_70y": 8, "male_70plus": 8,
        "female_9_13y": 8, "female_14_18y": 15, "female_19_30y": 18, "female_31_50y": 18, "female_51_70y": 8, "female_70plus": 8,
        "pregnancy_under18": 27, "pregnancy_19_30": 27, "pregnancy_31_50": 27,
        "lactation_under18": 10, "lactation_19_30": 9, "lactation_31_50": 9
      }
    },
    "vitamin_c_mg": {
      "type": "RDA",
      "unit": "mg",
      "values": {
        "child_1_3y": 15, "child_4_8y": 25,
        "male_9_13y": 45, "male_14_18y": 75, "male_19_30y": 90, "male_31_50y": 90, "male_51_70y": 90, "male_70plus": 90,
        "female_9_13y": 45, "female_14_18y": 65, "female_19_30y": 75, "female_31_50y": 75, "female_51_70y": 75, "female_70plus": 75,
        "pregnancy_under18": 80, "pregnancy_19_30": 85, "pregnancy_31_50": 85,
        "lactation_under18": 115, "lactation_19_30": 120, "lactation_31_50": 120
      }
    },
    "vitamin_d_mcg": {
      "type": "RDA",
      "unit": "mcg",
      "values": {
        "child_1_3y": 15, "child_4_8y": 15,
        "male_9_13y": 15, "male_14_18y": 15, "male_19_30y": 15, "male_31_50y": 15, "male_51_70y": 15, "male_70plus": 20,
        "female_9_13y": 15, "female_14_18y": 15, "female_19_30y": 15, "female_31_50y": 15, "female_51_70y": 15, "female_70plus": 20,
        "pregnancy_under18": 15, "pregnancy_19_30": 15, "pregnancy_31_50": 15,
        "lactation_under18": 15, "lactation_19_30": 15, "lactation_31_50": 15
      }
    }
  }
}
```

*(The JSON above includes the highest-priority nutrients pre-populated — fiber, sodium, sugar, protein, carbs, calcium, potassium, iron, vitamin C, vitamin D. Extend the same `life_stage_groups` keying pattern using the prose tables above for the remaining vitamins/minerals in Sections 4–5.)*

---

## 8. Implementation Notes for Your App

1. **UL vs. target**: UL values are safety ceilings, not goals — don't display them as "targets to hit," only as "don't exceed."
2. **Sodium**: Use the CDRR (2,300mg) as the practical daily target shown to users; the AI (1,500mg) is a lower population-average intake level, not a hard minimum users need to hit.
3. **Added sugar**: No RDA/AI exists — the field is a % of total calories, so it must be computed dynamically from the user's calorie target (10% × calories ÷ 4 kcal/g = grams).
4. **Pregnancy/lactation**: Only show these where you've captured that status — don't default to them.
5. **Life-stage boundaries**: DRI age brackets are not evenly spaced (e.g., 51–70 vs. 70+) — bucket user birthdates carefully at query time.
6. **Data provenance**: Store a `last_verified` field per nutrient in production, since Dietary Guidelines for Americans updates every 5 years (next scheduled 2030) and AHA/WHO figures can shift independently.
