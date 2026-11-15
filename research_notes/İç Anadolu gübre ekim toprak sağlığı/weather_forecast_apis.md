# Weather forecast and near-real-time weather/soil-moisture APIs for Arksus (Central Anatolia): access, skill, and agronomic uses

Research date: 2026-11-15. Labels used below:
- **[page]**: I read it on the fetched page.
- **[snippet]**: from a search-result snippet or a summary of one. The full text was not verified.
- **[test]**: my own live HTTP request on 2026-11-15, to a Konya point (lat 37.87, lon 32.48).

## 1. Open-Meteo: APIs, variables, horizons, models, terms, CORS

### Takeaway
Open-Meteo is the best fit for a static Vercel site:
- No API key.
- `Access-Control-Allow-Origin: *`, verified live.
- A 16-day forecast that includes soil moisture in 5 layers, soil temperature, FAO-56 ET0 and precipitation probability.
- A separate seasonal endpoint (EC46 for 46 days, then SEAS5 to 7 months, 51 members).

The free tier is non-commercial only (no ads, no subscriptions), allows 10,000 calls a day, and requires CC BY 4.0 attribution "next to" the displayed data. A non-profit hackathon site without ads fits the published definition. The terms do not mention hackathons.

### Cited findings

**Forecast API (`api.open-meteo.com/v1/forecast`)**
- **Horizon:** `forecast_days` defaults to 7 and goes up to 16. `past_days` accepts 0–92. — [page] [Open-Meteo docs](https://open-meteo.com/en/docs)
- **Daily variables:** `temperature_2m_max/min/mean`, `precipitation_sum`, `rain_sum`, `showers_sum`, `snowfall_sum`, `precipitation_hours`, `precipitation_probability_max/mean/min`, `wind_speed_10m_max`, `wind_gusts_10m_max`, `wind_direction_10m_dominant`, `shortwave_radiation_sum` (MJ/m²), `et0_fao_evapotranspiration` (mm). Humidity, dew point and growing degree days are also listed. — [page] [Open-Meteo docs](https://open-meteo.com/en/docs)
- **Hourly soil variables:** `soil_temperature_0cm/6cm/18cm/54cm` (°C) and `soil_moisture_0_to_1cm`, `_1_to_3cm`, `_3_to_9cm`, `_9_to_27cm`, `_27_to_81cm` (m³/m³). — [page] [Open-Meteo docs](https://open-meteo.com/en/docs)
- **`et0_fao_evapotranspiration`** is FAO-56 Penman-Monteith for well-watered grass and assumes unlimited soil water. Hourly values are preceding-hour sums in mm. — [page] [Open-Meteo docs](https://open-meteo.com/en/docs)
- **`precipitation_probability`** is the probability of more than 0.1 mm in the preceding hour. It comes from ensemble models at about 0.25° with 30 members. — [page] [Open-Meteo docs](https://open-meteo.com/en/docs)
- **Models:**
  - `best_match` (default) combines the best models for each location.
  - Global options: ECMWF IFS and AIFS (9–25 km), NCEP GFS (0.11°/0.25°), DWD ICON (2–11 km, with EU and D2 variants), Météo-France ARPEGE/AROME, JMA, CMA GRAPES, GEM, UK Met Office.
  - Discontinued: KMA (no updates since 2026-03-31) and BOM ACCESS-G (no updates since 2025-06-26).
  - — [page] [Open-Meteo docs](https://open-meteo.com/en/docs)
- **URL pattern:** `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&daily=..`. Several points can be comma-separated in one call. — [page] [Open-Meteo docs](https://open-meteo.com/en/docs)

**Live test results** [test], against `api.open-meteo.com/v1/forecast` for the Konya point with `forecast_days=16`, `timezone=Europe/Istanbul`:
- Returned HTTP 200 with `access-control-allow-origin: *` and `access-control-allow-methods: GET, POST, OPTIONS`.
- Response headers included `X-RateLimit-Limit: 600.0` and `X-RateLimit-Window: 60`.
- Returned elevation was 1024 m.
- 16 daily values were returned for `precipitation_sum`, `precipitation_probability_max`, `temperature_2m_min` and `et0_fao_evapotranspiration`.
- With `best_match`, hourly `soil_moisture_9_to_27cm` and `soil_temperature_6cm` were non-null for 352 of 384 hours, up to 2026-11-29T15:00. The soil fields therefore cover about 14.6 days, not the full 16.
- This run's forecast showed minimum temperatures of −3.4 °C around 26–27 Nov and almost no rain over 16 days. This is a single example, not a validated result.

**Seasonal Forecast API (`seasonal-api.open-meteo.com/v1/seasonal`)**
- Uses ECMWF SEAS5 and EC46. The default "Seamless" option takes EC46 for the first 46 days, then SEAS5. The page does not mention SEAS5.1. — [page] [Open-Meteo Seasonal docs](https://open-meteo.com/en/docs/seasonal-forecast-api)
- **Grid:** 36 km (O320), native 6-hourly. **Horizon:** default 6 months, up to 7.
- **Ensemble:** 51 members per model (EC46 produces 100, but Open-Meteo serves 51), plus an ensemble mean.
- **Updates:** EC46 daily at about 20:30 UTC. SEAS5 monthly on the 5th.
  - — [page] [Open-Meteo Seasonal docs](https://open-meteo.com/en/docs/seasonal-forecast-api)
- **Outputs:**
  - Weekly anomalies from EC46 (up to 6 weeks) and monthly anomalies from SEAS5 (up to 7 months).
  - Extreme Forecast Index (EFI), Shift of Tails (SOT) and anomaly exceedance probabilities.
  - Soil moisture in 4 layers (0–7, 7–28, 28–100, 100–255 cm), as daily and monthly means and anomalies.
  - — [page] [Open-Meteo Seasonal docs](https://open-meteo.com/en/docs/seasonal-forecast-api)
- The page warns the data are "not bias-corrected and may not accurately reflect local conditions". It recommends reading them as area-level warmer/colder or wetter/drier outlooks. Anomalies are computed against a hindcast model climatology of typically 20–30+ years. — [page] [Open-Meteo Seasonal docs](https://open-meteo.com/en/docs/seasonal-forecast-api)
- [test] The seasonal endpoint for the Konya point returned HTTP 200 with `access-control-allow-origin: *`.

**Previous Runs API**
- Serves past forecasts at fixed lead times, `_previous_day1` to `_previous_day7`.
- The page says comparing these against observations or reanalysis lets you measure how skill degrades with lead time. Its example is the MAE of `_previous_day3` forecasts against ERA5.
- Most models are archived from January 2024. GFS 2 m temperature goes back to March 2021, and JMA to 2018.
- — [page] [Open-Meteo Previous Runs API](https://open-meteo.com/en/docs/previous-runs-api)
- The Historical Forecast API and the Climate Change API (CMIP6) appear only in navigation on that page. I did not read their docs pages.

**Terms, limits and licence**
- **Free limits:** "Less than 10'000 API calls per day, 5'000 per hour and 600 per minute". The pricing table gives 300,000 calls a month. Limits apply per IP and per application. — [page] [Open-Meteo Terms](https://open-meteo.com/en/terms); [page] [Pricing](https://open-meteo.com/en/pricing)
- **Non-commercial** follows the Creative Commons definition. — [page] [Terms](https://open-meteo.com/en/terms)
  - Non-commercial includes "private or non-profit websites and apps" with no subscriptions or ads, public research at public institutions, educational content, and voluntary donations or tip jars.
  - Commercial includes sites with subscriptions or ads, commercial products or promotion, and undisclosed research at commercial entities.
  - Hackathons are not mentioned.
- **Page date:** the terms page has no "last updated" date, only a © 2022–2026 range. It says changes are tracked on GitHub. — [page] [Terms](https://open-meteo.com/en/terms)
- **Call counting:** a request with more than 10 variables, or more than 2 weeks for one location, counts as fractional extra calls. For example, 2 weeks with 15 variables counts as 1.5 calls. — [page] [Pricing](https://open-meteo.com/en/pricing)
- **Paid tiers:**
  - Standard: 1M calls/month. Professional: 5M. Enterprise: 50M+.
  - Paid tiers use the `customer-api.open-meteo.com` domain with an `apikey` parameter.
  - The historical, climate, ensemble and satellite-radiation APIs need Professional or higher for commercial use.
  - Prices are shown only in Stripe checkout.
  - — [page] [Pricing](https://open-meteo.com/en/pricing)
- **API key:** the forecast docs say `apikey` is only needed for commercial use. — [page] [Open-Meteo docs](https://open-meteo.com/en/docs)
- **Attribution:** data are CC BY 4.0, and attribution is required even for paid plans. — [page] [Pricing](https://open-meteo.com/en/pricing)
  - Attribution must be placed "next to any location Open-Meteo data are displayed". It should name Open-Meteo, link CC BY 4.0, and state whether the data were modified.
  - The example given is `<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>`.
  - Upstream sources and their licences: ECMWF CC-BY, DWD CC-BY, NOAA NCEP (NOAA licence), C3S (Copernicus licence), UK Met Office CC-BY-SA, and others.
  - The Open-Meteo source code is AGPLv3.
  - — [page] [Open-Meteo Licence](https://open-meteo.com/en/licence)
- **CORS:** the official docs and pricing pages do not mention CORS. — [page] [docs](https://open-meteo.com/en/docs), [pricing](https://open-meteo.com/en/pricing). The live test confirmed `*` on both the forecast and seasonal endpoints [test]. Third-party directories also say CORS is supported with no auth. — [snippet] [public-api.org](https://public-api.org/api/1412/open-meteo), [DEV Community](https://dev.to/0012303/open-meteo-has-a-free-weather-api-no-key-no-signup-real-forecast-data-2nna)

### Inferences
- **Commercial status:** Arksus is a public, non-profit hackathon site with no ads or subscriptions. Under the published Creative Commons definition it falls in "non-profit websites and apps". This is my reading of the terms, not a ruling from Open-Meteo. If the project later gets a sponsor, ads, or a commercial spin-off, it would need a paid plan.
- **Rate limits:** the limits are per IP. Browser calls from each farmer's device spread the load across users, so 10,000 calls a day is unlikely to bind. Caching per field and per day (for example in `sessionStorage`) still reduces calls.
- **Request size:** keep requests to 10 or fewer variables to avoid fractional extra-call counting.
- **Soil fields:** Open-Meteo soil moisture and temperature are model outputs, not measurements. Per the repo's badge rule they would be labelled "model", and precipitation probability "model" as well. The site's water balance is driven by NASA POWER, so Open-Meteo soil moisture is best shown as context rather than fed into the engine.
- **Attribution placement:** the attribution line must sit next to every forecast card, not only in a footer.

### Gaps
- No official Open-Meteo statement on CORS was found; it was verified only empirically.
- The terms page has no date. Changes would show in the Open-Meteo GitHub history, which I did not inspect.
- Climate Change API (CMIP6 downscaled) details were not read: models, resolution, and whether it covers soil moisture.
- Ensemble API docs were not read (member counts per model).

## 2. Alternatives: MGM, NASA POWER near-real-time, ECMWF open data, C3S, NOAA GFS

### Takeaway
None of the alternatives is as convenient as Open-Meteo for keyless browser calls.
- **NASA POWER** sends `Access-Control-Allow-Origin: *`, verified live, so the existing POWER integration can stay browser-side. It is historical and near-real-time, not a forecast.
- **ECMWF open data** is CC-BY-4.0 and free, but it is GRIB files that need server-side processing.
- **MGM** sells station data through MEVBİS. No public developer API was found. MGM's agro-meteorology products (ZDUS frost warning, Tarımsal Hava Tahmini, "Uygun Ekim Zamanı") are web pages to link to, not to embed.

### Cited findings
- **NASA POWER** [test]: a daily point request (`PRECTOTCORR`, AG community, Konya, 2026-11-01 to 2026-11-14) returned HTTP 200 with `access-control-allow-origin: *`.
- **MGM MEVBİS:**
  - MGM's products page lists "Meteorolojik Veri-Bilgi Sunum ve Satış Sistemi - MEVBİS" among paid products, with 2026 pricing rules. The marketing unit contact is pazarlama@mgm.gov.tr. — [snippet] [MGM Ürünler](https://mgm.gov.tr/site/urunler.aspx?u=tum)
  - Regional service standards give 7 working days after the payment receipt is submitted. — [snippet] [MGM Kayseri kamu hizmet standartları](https://mgm.gov.tr/FILES/kurumsal/kamuhizmet/kayseri.pdf)
  - A 2017 circular routes meteorological data requests through MEVBİS. — [snippet] [Lexpera](https://www.lexpera.com.tr/mevzuat/genelgeler/meteorolojik-bilgi-talepleri-genelgesi-2017-02)
  - No official MGM API documentation was found.
- **MGM Ziraat menu:** lists the Zirai Don Uyarı Sistemi (ZDUS, with a map at `zirai-don-uyari-sistemi-harita.aspx`), Hasat Zamanı Tahmini, Tarımsal Hava Tahmini (tarim.mgm.gov.tr), BİSİP chill calculator, Sıcağa ve Soğuğa Dayanıklılık, SINEP, Referans ETo, Aylık Bülten, "Uygun Ekim Zamanı", and Fenoloji Haritaları. — [page] [MGM ZDUS](https://www.mgm.gov.tr/tarim/zdus.aspx)
  - The ZDUS page itself gives no crops, thresholds or lead time. — [page] same
- **MGM frost bulletins:** MGM issues "Zirai Don" warnings, for example bulletin No. 570 for 7–10 Nov 2026, "İç ve Doğu Kesimlerde Zirai Don Bekleniyor". — [snippet] [MGM uyarı](https://www.mgm.gov.tr/tahmin/uyari-goster.aspx?sN=26050570e)
  - MeteoUyarı includes a "Zirai Don" category. — [snippet] [MGM MeteoUyarı](https://www.mgm.gov.tr/meteouyari/il.aspx)
  - An MGM article describes a daily agro-weather report giving 5-day guidance for field work (sowing, spraying, fertilizing, harvest). — [snippet only; the PDF text was not readable] [MGM Türktarım article](https://mgm.gov.tr/FILES/genel/makale/Turktarim.pdf)
- **ECMWF open data:**
  - The real-time IFS and AIFS subset is free, under CC-BY-4.0 plus ECMWF Terms of Use. — [snippet] [ECMWF open data](https://ecmwf.int/en/forecasts/datasets/open-data)
  - Since 1 Oct 2025 the whole catalogue is CC-BY-4.0 with no data costs, but delivery may carry service charges. — [snippet] [ECMWF](https://www.ecmwf.int/node/28188)
  - One ECMWF page mentions 0.1° IFS open data from 20 Oct 2026. — [snippet, unconfirmed] [ECMWF](https://www.ecmwf.int/node/37688)
  - A data directory listing exists at `data.ecmwf.int/forecasts/<date>/<run>/ifs/0p25/oper/`. — [snippet] [data.ecmwf.int](https://data.ecmwf.int/forecasts/20260514/06z/ifs/0p25/oper/)
- **TARBİL:** about 400 field stations, aimed at early warning and extension. — [snippet] [UNCCD TARBİL](https://www.unccd.int/resources/knowledge-sharing-system/tarbil-agricultural-monitoring-and-information-system)

### Inferences
- **ECMWF open data and NOAA GFS** are GRIB2 bulk files. In a browser they would need a pre-processing step, such as a build-time cron that writes static JSON. Open-Meteo already re-serves these models (ECMWF IFS, GFS, ICON) as point JSON, so it is the practical proxy for them.
- **C3S seasonal (Copernicus CDS)** is generally accessed with a registered account and API key, so it is not keyless from a browser. This is my inference; I did not verify the current CDS access rules. Open-Meteo's seasonal endpoint re-serves ECMWF SEAS5 without a key.
- **MGM** fits as an outbound link ("for official frost warnings see MGM ZDUS"), not as a data source.

### Gaps
- NASA POWER near-real-time latency was not researched (how many days behind for precipitation and temperature).
- Whether NOAA NOMADS or AWS GFS endpoints send CORS headers was not checked.
- Current CDS/C3S access terms and API-key requirement were not read.
- Contents and lead time of MGM "Uygun Ekim Zamanı" and Tarımsal Hava Tahmini were not read, nor whether they cover wheat or chickpea in Konya. This matters for the originality claim.

## 3. Accuracy and skill (short range to seasonal) and honest presentation

### Takeaway
- **Medium range:** precipitation skill decays with lead time. ECMWF tracks it by the lead time at which 24 h precipitation SEEPS reaches 45% (deterministic) and CRPSS reaches 10% (ensemble), in the extratropics. I could not read the current values.
- **Seasonal:** over Türkiye, SEAS5 precipitation skill is weak. It approaches climatology in many regions and is weakest in winter. Temperature skill is much better.
- **Implication:** a seasonal "fallow vs crop" decision should not hinge on a SEAS5 precipitation outlook.

### Cited findings
- **ECMWF headline precipitation scores:**
  - HRES: the lead time at which SEEPS for 24 h precipitation reaches 45% in the extratropics. ENS: the lead time at which CRPSS reaches 10%.
  - Live values are on Opencharts (`plwww_m_hr_seepsreach_ts_hs`, `plwww_m_eps_tpcrpssreach_ts`).
  - The page copy I read was version 15, Jan 2023.
  - — [page] [ECMWF Monitoring IFS accuracy](https://confluence.ecmwf.int/x/tLeLEg)
- **ECMWF verification notes:** extratropical SEEPS gained about 2 days over 14 years at lead times of 3–9 days. Early-range SEEPS was weaker than other centres because ECMWF over-forecast light precipitation on dry days. — [snippet, 2010s technical notes] [ECMWF 2012 SEEPS intercomparison](https://www.ecmwf.int/sites/default/files/elibrary/2012/9732-intercomparison-global-model-precipitation-forecast-skill-201011-using-seeps-score.pdf)
- **SEAS5 over Türkiye, 1993–2022, 51 members** (ITU thesis abstract):
  - Temperature skill is "relatively high and stable across all clusters and seasons".
  - Precipitation skill "approaches climatological performance" in many regions, especially complex terrain and coasts.
  - The largest uncertainties are in winter and in wetter clusters.
  - Discrimination is best in spring and summer.
  - Meaningful skill appears mainly at seasonal accumulation (SPI-3), weaker at SPI-1.
  - The NAO influence is "only weakly translated" into local skill.
  - — [snippet, abstract only] [ITU Polen](https://polen.itu.edu.tr/items/2cea59d2-17c7-4b32-8e6a-b3e6f2c9cd21)
- **MGM evaluation of 2024 SEAS5 drought forecasts (SPEI-3):**
  - Precipitation forecast accuracy is "typically lower in Anatolia", partly because of small-to-medium-scale precipitation events.
  - The study still concludes SEAS5 can be used for drought forecasting (SPEI-based).
  - — [snippet] [MGM Evaluation of 2024](https://mgm.gov.tr/FILES/genel/makale/Evaluationof2024.pdf); [DOAJ record](https://matdisc.unitech.ac.pg/Record/doaj-art-beb78d5c27084f3b9075201f3f9ddf67/Description)
- **SEAS5 system:** operational since November 2017. Mid-latitude skill is limited across seasonal systems in general. — [snippet] [Johnson et al. 2019, GMD](https://gmd.copernicus.org/articles/12/1087/2019/)
- **Open-Meteo's own seasonal caveat:** not bias-corrected, and best read as area-level terciles or tendencies. — [page] [Open-Meteo Seasonal](https://open-meteo.com/en/docs/seasonal-forecast-api)

### Inferences
**Presentation rules** consistent with the repo's "no certainty language" rule:
- **Days 1–3:** show amounts.
- **Days 4–10:** show probability bands, for example "≥5 mm chance: 40%", from `precipitation_probability_max` or Ensemble API member counts.
- **Days 11–16:** show only a "wetter/drier than usual" tendency, or hide it.
- **Seasonal:** show at most a tercile tendency for temperature. Show precipitation only with a "low skill in Anatolia" warning, badged "model". Do not let it change the rotation recommendation.

**Local verification:** the Previous Runs API (archive from Jan 2024) lets the team compute local MAE or hit rates for 1–7-day precipitation against NASA POWER at the 5 pilot districts. That gives an honest, local, sourced accuracy statement instead of a generic one.

### Gaps
- Current numeric SEEPS-45% and CRPSS-10% lead times (Opencharts not fetched). I found no published single "useful precipitation days" figure for Türkiye.
- Full text of the ITU thesis and the MGM 2024 paper was not read; no RPSS or ROC values or Central Anatolia-specific numbers.
- No study was found on short-range (1–10 day) precipitation verification specifically for Central Anatolia.

## 4. Agronomic uses with literature rules

### Takeaway
The strongest literature-backed use is **urea top-dressing timed before rain**.
- Roughly 6–10 mm soon after application cuts NH3 loss sharply. Losses rise the longer rain is delayed, and about 3 mm can increase loss.
- Spray windows (wind roughly 3–10 mph, about 5–16 km/h, and no inversion) and heat at anthesis (above about 31 °C) have extension or review support.
- Germination temperature thresholds are thinner. One extension table gives wheat a minimum of about 4 °C, and one study gives chickpea a germination base of about 4.2 °C.
- No source supported a −2 °C "flowering frost" rule.
- A seasonal outlook as the fallow-vs-crop trigger is not scientifically defensible for precipitation in Anatolia (section 3).

### Cited findings

**(b) Urea and rain**
- **Manitoba Agriculture fact sheet:**
  - Rain required to incorporate urea is quoted from 0.1 inch (2.5 mm, Michigan) to 0.25 inch (6 mm, Minnesota and North Dakota). Losses increase the longer rain is delayed.
  - Pennsylvania no-till data:
    - 0.4 inch (about 10 mm) within 2 days: 0% loss.
    - Within 3 days: 10% loss.
    - 0.1–0.2 inch within 5 days: 10–30% loss.
    - No rain in 5 days: more than 30% loss.
  - At pH 7.5, loss is about 20% at 4 days and about 44% at 10 days. At pH 6.5 it is about 10% at 4 days.
  - At 25 °C, 38–46% N loss over 5 days, versus under 7% at 15 °C.
  - Risk factors: pH above 7.5, high lime, coarse texture, low organic matter, high residue or zero-till, wind, and moist soil followed by rapid drying.
  - — [page] [Manitoba Agriculture](https://gov.mb.ca/agriculture/crops/soil-fertility/volatilization-losses-from-surface-applied-nitrogen.html)
- **Sanz-Cobena et al. 2011:** adding 7 and 14 mm of water immediately after urea cut NH3 emission by 77% and 89%. A simulated 3 mm rain "significantly enhanced" volatilisation. — [snippet; the Rothamsted PDF link returned 404] [Rothamsted repository](https://repository.rothamsted.ac.uk/download/77d194b7b8001261ea4f7ff0e4d6a6b829ca12b765995487234d72a6a99c4685/969650/Sanz-cobena-2011-Effect-of-water-addition-and-the-ur.pdf)
- **Dempsey et al. (Agronomy Journal 2017):** NH3 loss from untreated urea fell from 8.6% of applied N with no rain to 0.6% with 25.4 mm simulated rain. Rain may increase denitrification loss. — [snippet] [ASA 2013 poster / Dempsey](https://a-c-s.confex.com/crops/2013am/webprogram/Handout/Paper78153/2013%20Tampa%20ASA%20Poster%20R.%20Dempsey.pdf)
- **Dempsey 2013 poster:** predicted rain needed for zero NH3 loss was 9.8 mm for urea+NBPT and 20.5 mm for plain urea. — [snippet] same link

**(c) Spray windows**
- Ohio State: winds below 5 mph, with good practice, significantly reduce drift injury. — [snippet] [OSU C.O.R.N.](https://agcrops.osu.edu/newsletter/corn-newsletter/2019-22/use-more-caution-year-reduce-spray-drift)
- Iowa State: spray below 10 mph, with the wind away from sensitive areas. — [snippet] [Iowa State](https://crops.extension.iastate.edu/cropnews/2009/05/drift-management-considerations)
- K-State: there is no universal maximum, but about 10 mph is suggested. Drift-control additives cut downwind deposits by 50–80% in some cases. — [snippet] [K-State MF2444](https://bookstore.ksre.ksu.edu/download/strategies-to-reduce-spray-drift_MF2444)
- UGA: most herbicides at 3–10 mph. Low wind with a temperature inversion can also cause severe drift. — [snippet] [UGA](https://newswire.caes.uga.edu/story/5044/herbicide-drift.html)
- SDSU: take care near sunrise and sunset, and never spray toward sensitive areas. — [snippet] [SDSU](https://extension.sdstate.edu/how-stop-drift)
- A "no rain for X hours" (rainfastness) rule was not found. One search on this was blocked by a tool filter, and I did not retry it.

**(d) Frost and heat thresholds**
- **Wheat anthesis heat:** a review of 65 studies gives an optimum around 21 °C, with pollination success limited above 31 °C. A 5-day period above 31 °C ending at anthesis reduced seed set. — [snippet] [PMC review](https://pmc.ncbi.nlm.nih.gov/articles/PMC7540836); [CSIRO FP14061](https://publish.csiro.au/FP/fulltext/FP14061)
- **Wheat frost:** no source was found for a −2 °C flowering frost threshold. A threshold table lists −20 °C for winter-wheat frost, which is a hardened vegetative-stage value. — [snippet] [PMC table](https://pmc.ncbi.nlm.nih.gov/articles/PMC8299469/table/T1)
- **MGM ZDUS** exists for frost risk, but its stage thresholds were not visible. — [page] [MGM ZDUS](https://www.mgm.gov.tr/tarim/zdus.aspx)

**(a) Sowing timing**
- **Wheat:** the Alberta extension table gives a minimum germination soil temperature of 4 °C and a preferred 20 °C. Cool soil delays germination and gives uneven emergence. — [snippet] [Alberta Agdex 1203](https://www1.agriculture.alberta.ca/$department/deptdocs.nsf/all/agdex1203)
- **Chickpea:**
  - Genotypes averaged base temperatures of 4.2 °C for germination and 6.1 °C for emergence. Optimum germination was 20.4–26.5 °C. — [snippet] [PMC8683030](https://pmc.ncbi.nlm.nih.gov/articles/PMC8683030)
  - GRDC: chickpea germinates within days if the soil is above 0 °C. Field emergence takes 7–30 days. About 115 °C·days from sowing to emergence at 50 mm depth. — [snippet] [GRDC GrowNote Chickpea South](https://grdc.com.au/__data/assets/pdf_file/0031/369427/GrowNote-Chickpea-South-4-Physiology.pdf)
  - Maximum emergence needs moisture near field capacity. 33–75% of field capacity reduced germination. Sowing can go to 10–15 cm in moisture-deficient soils. — [snippet] [JAF](https://jaf.su.edu.pk/uploads/journals/JAF-6-2-3-3.pdf); [PMC7598726](https://pmc.ncbi.nlm.nih.gov/articles/PMC7598726)

### Inferences
**Rule candidates** for `engine/config` YAML, all `verified: false` until a primary paper is read:
- **Urea:** "top-dress when ≥6–10 mm (≥ `X` mm, source: Manitoba/Sanz-Cobena) is forecast within 2 days and probability ≥ p".
  - Warn when only 1–4 mm is forecast, since light rain can raise losses.
  - Warn when no rain is forecast for 5+ days and temperatures are warm.
  - Central Anatolian soils are often calcareous with pH above 7.5. That puts them in the high-risk class on the Manitoba list.
- **Heavy rain:** no literature threshold for "too heavy" (runoff) was found, so that rule would be an assumption.
- **Spray:** `wind_speed_10m` ≤ about 16 km/h (10 mph) and ≥ about 5 km/h (3 mph). Avoid calm dawn or dusk hours (inversion risk).
  - Open-Meteo wind is at 10 m, while extension guidance usually refers to boom height. That mismatch should be noted.
- **Sowing:** `soil_temperature_6cm` > about 4 °C, plus soil moisture or recent rain. This fits Ömer's water balance. The "wait for X mm" rule for rainfed sowing has no source here and would be an assumption.
- **Frost:** for frost after emergence, defer to MGM ZDUS (link out) rather than inventing a stage threshold.
- **Seasonal outlook:** using SEAS5 precipitation for the fallow-vs-crop call is not defensible given Türkiye verification (section 3). At most, show it as context with a low-skill badge.

### Gaps
- Primary full texts were not read: Sanz-Cobena 2011 (exact journal and site), Dempsey 2017, and the wheat heat review authors.
- No Türkiye or Central Anatolia field study on urea volatilization versus rain timing was found.
- No literature thresholds were found for heavy-rain runoff of fertilizer or for rainfastness hours.
- No Turkish agronomic guidance on minimum rain or soil moisture before rainfed wheat sowing was found, for example from Tarla Bitkileri Merkez Araştırma Enstitüsü or the Bahri Dağdaş Konya institute.
- No source for wheat frost thresholds by growth stage (tillering, jointing, heading).

## 5. Existing apps or sites combining forecasts with sowing or fertilizer advice (originality)

### Takeaway
Türkiye already has public agro-meteorology services:
- MGM ZDUS frost warnings, Tarımsal Hava Tahmini, "Uygun Ekim Zamanı" and Hasat Zamanı Tahmini.
- TARBİL, with about 400 stations.
- An MGM-described 5-day field-work report.

None of these was found to combine a field-level water balance, a rotation recommendation and a fertilizer-timing rule tied to forecast rain. Arksus's originality claim should be that integration, not "first agro-weather forecast in Türkiye".

### Cited findings
- **MGM Ziraat products:** ZDUS, Hasat Zamanı Tahmini, Tarımsal Hava Tahmini, BİSİP, SINEP, ETo, Aylık Bülten, Uygun Ekim Zamanı, Fenoloji Haritaları. — [page] [MGM ZDUS](https://www.mgm.gov.tr/tarim/zdus.aspx)
- **MGM daily agro-weather report** with 5-day guidance on sowing, spraying, fertilizing and harvest. — [snippet] [MGM Türktarım](https://mgm.gov.tr/FILES/genel/makale/Turktarim.pdf)
- **TARBİL:** about 400 stations, with early-warning and extension goals. — [snippet] [UNCCD](https://www.unccd.int/resources/knowledge-sharing-system/tarbil-agricultural-monitoring-and-information-system)
- **Other apps:**
  - The İzmir Büyükşehir "İzmir Tarımı" app reportedly has 15 alert types. — [snippet, via search summary; no direct source fetched]
  - A Metos (Pessl) Türkiye testimonial claims disease-risk forecasts help with input use. — [snippet] [Metos testimonial](https://metos.global/wp-content/uploads/2022/07/Testimonial-Turkey-MURAT_SALIH.pdf)
  - The Ministry has a forecast and warning leaflet. — [snippet] [Tarım Bakanlığı Tahmin-Uyarı](https://www.tarim.gov.tr/GKGM/Belgeler/Uretici_Bilgi_Kosesi/Brosurler/Tahmin_Uyari_liflet.pdf)

### Inferences
- Linking out to MGM ZDUS for frost, and to MGM Tarımsal Hava Tahmini for official forecasts, strengthens credibility and avoids duplicating official warnings.

### Gaps
- MGM "Uygun Ekim Zamanı" and tarim.mgm.gov.tr content were not read, including which crops and inputs (rainfall or soil temperature) they use. These are the closest competitors and should be checked before any originality claim.
- TARSİM's farmer-facing forecast tools were not researched.
- International examples were not researched (FAO, Australian Yield Prophet, US urea-timing tools).
