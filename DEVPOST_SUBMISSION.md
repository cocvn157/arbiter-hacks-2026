# Arbiter Hacks V1 — Devpost Submission Copy-Paste Pack

**Target Track:** Theme Track — **Rethinking Waste**  
**Project Name:** CycleArbiter  
**Tagline (60 chars max):** Cold-chain spoilage kinetics & circular waste routing engine  
**Live Demo URL:** `https://cocvn157.github.io/arbiter-hacks-2026/`  
**Public Repository URL:** `https://github.com/cocvn157/arbiter-hacks-2026`  
**Built With:** `typescript`, `react`, `vite`, `vitest`, `svg`, `operations-research`

---

## 1. Devpost "What It Does" / Inspiration / How We Built It (Copy-Paste)

### Inspiration
Commercial grocers, campus dining halls, and urban food hubs lose tons of edible surplus every week—not because communities don't need the food, but because **spoilage clocks outrun manual phone/spreadsheet coordination**. Simultaneously, wet or grease-contaminated packaging gets tossed into single-stream recycling bins, causing entire clean bales at Material Recovery Facilities (MRFs) to be rejected to landfills. We built **CycleArbiter** to give SMEs, food banks, and municipal waste coordinators an instant, zero-infrastructure arbitrage engine that puts every kilogram at the highest safe tier of the circular economy.

### What It Does
**CycleArbiter** runs 100% deterministically in the browser ($0 server cost, zero API keys required) and executes four tightly coupled engineering engines in under 5 milliseconds per solve:
1. **Q10 Thermal Decay Kinetics & FDA TCS Safety Engine:** Models shelf-life remaining (`RSH`) for 10 material classes using `Q10^((T_eff - T_ref)/10)` kinetics, dock excursion penalties, and packaging insulation. Automatically enforces FDA Time/Temperature Control for Safety (TCS) 4-hour excursion blocks on high-risk protein/dairy lots—preventing unsafe food donations while diverting spoiled stock straight to anaerobic biogas instead of landfill.
2. **Contamination & Moisture MRF Guardrail:** Evaluates moisture (`%`) and contamination (`%`) against each facility's tolerance. Rain-soaked or produce-stained corrugated cardboard is automatically routed away from optical MRFs into anaerobic fiber digestion so dry recyclables stay uncontaminated.
3. **Capacity-Constrained Multi-Objective Router:** Allocates scarce chilled food-bank capacity to the highest-urgency safe lots first and cascades overflow cleanly through Flash Upcycle Kitchens, Livestock/BSF Feed Mills, Anaerobic Digesters, MRFs, and R2v3 E-Waste Refurbishers across four tunable policy modes (*Balanced*, *Max Meals*, *Max CO2e*, *Min Cost*).
4. **Precedence-Constrained 2-Opt Fleet Dispatch:** Splits refrigerated vans vs. ambient haul trucks, packs vehicles under payload bounds, and runs nearest-neighbor + precedence-preserving 2-opt optimization to sequence multi-stop pickup-before-dropoff milk-runs.

Users can switch between three realistic urban scenarios, stress-test ambient heatwaves (`+0°C` to `+12°C`) and moisture gates live, log custom lots or batch-import their own CSV waste manifests, inspect transparent per-lot decision rationales + `0–48h` thermal viability curves, and export **Audit CSV** and **Dispatch Manifest JSON** reports.

### Theme Track Requirement — Specific Waste Problem & Impact Measurement
**Waste Problem Targeted:** CycleArbiter targets **time-sensitive cold-chain food spoilage** at retail/institutional docks and **cross-contamination rejections in commercial packaging recycling**—the two highest-leverage failure points driving preventable municipal organic methane emissions and MRF bale downgrades.  
**How Success & Impact Are Measured:** Every routing plan computes exact counterfactual deltas against a municipal landfill baseline (`$82/ton` tipping fee + EPA WARM-aligned per-material landfill `kg CO2e/kg`):
- **Landfill Diversion Rate (`%` & `kg`):** Share of total mass routed to human rescue, animal feed, anaerobic biogas/compost, MRF recycling, or e-waste refurbishment.
- **Edible Meals Rescued:** Safe edible mass routed within transit + 1.25h buffer margins converted at USDA's `0.45 kg/meal` standard.
- **Net CO2e Abatement (`kg CO2e`):** Lifecycle avoided methane and virgin material offsets minus actual refrigerated/dry fleet haul emissions (`0.31` / `0.24 kg CO2e/km`).
- **Net Circular Economic Value (`$`):** Avoided landfill tipping fees plus nutritional/commodity rebates minus hub handling and vehicle fuel costs.

### How We Built It
We built the algorithmic core in pure, strict-typed TypeScript (`src/engine/`) with zero external backend dependencies so any municipality or nonprofit can host it statically on GitHub Pages or run it offline on a tablet. The interactive command center uses React 19, Vite 6, and custom high-DPI SVG visualizations for the `18 × 12 km` spatial dispatch map and `0–48h` thermal viability sparklines. Correctness is verified by an 11-test Vitest unit/integration suite plus headless Microsoft Edge (`1280×720`) E2E verification.

### Challenges We Ran Into
Calibrating capacity spillover and precedence-constrained 2-opt routing so high-shelf-life dry pantry goods don't inadvertently get stranded when chilled food banks fill up, while strictly guaranteeing every vehicle pickup precedes its dropoff stop without violating cold-chain segregation.

### Accomplishments That We're Proud Of
- Real food-safety and recycling-physics guardrails (FDA TCS 4-hour excursion block, moisture-gated MRF protection, Q10 decay curves) rather than generic hardcoded labels.
- Sub-5ms live re-optimization across every policy slider, custom lot entry, and CSV batch import.
- Full explainability: every lot exposes *why* higher tiers were rejected and how the winning destination beat alternatives.

### What We Learned & What's Next
- **What's next:** Integrate optional GS1-128 / QR cold-chain logger BLE imports for grocery receiving docks, multi-depot route time-windows, and community webhook alerts for volunteer rescue couriers.

---

## 2. 2-Minute 30-Second Demo Video Script (For Loom / OBS -> YouTube/Vimeo)

- **0:00–0:20 (The Hook & Problem):** Open `https://cocvn157.github.io/arbiter-hacks-2026/`. Explain: *"Every day, commercial grocers and markets throw out tons of salvageable food because spoilage clocks move faster than spreadsheets—while wet cardboard ruins clean recycling bales. Meet CycleArbiter: a zero-backend waste arbitration engine."*
- **0:20–0:55 (Live Triage & Safety Gates):** Point to the 4 KPI cards (`100.0%` diverted, `5,044 meals`, `+10,638 kg CO2e`, `$6,058 net value`). Click **`LOT-103 Wild Salmon Fillets`** in the Priority Triage Queue. Show the **Arbiter Decision Trace** on the bottom-right: point out the **FDA TCS 4-hour cold-chain block** stopping unsafe human donation while automatically rescuing it into **Southside Anaerobic Biogas** instead of landfill. Then click **`LOT-107 Produce-Soaked Corrugated Cartons`** to show how **26% moisture** triggers MRF rejection and protects clean OCC bales.
- **0:55–1:35 (Live Heatwave Stress Simulator & Map):** Drag the **Ambient Heatwave Stress** slider from `+0°C` up to `+10°C`. Watch the KPIs, `Q10` viability curve, and EPA hierarchy bar re-optimize instantaneously in `<5 ms`. Switch tabs to **`Campus & Night Market Organics`** and **`SME Packaging & E-Waste Cleanout`** to show e-waste refurbishment and optical MRF routing on the spatial map.
- **1:35–2:10 (Real CSV Import & Audit Export):** Click **`+ Log Lot / CSV`**, add a custom chilled dairy lot (or paste CSV batch), hit **`Route Lot via Arbiter`**, and watch the new lot immediately appear on the map and triage queue. Click **`Audit CSV`** to show the exportable municipal ledger.
- **2:10–2:30 (Closing & Impact):** Click **`Model Spec`** briefly to highlight the transparent physics & EPA WARM methodology, and conclude with the measurable impact metrics.
