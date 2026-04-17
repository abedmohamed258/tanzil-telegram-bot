# ⚡ TANZIL: THE AUTOMATED PRODUCTION PIPELINE (v17.0)

> **"Code as an Assembly Line."**
> Every Phase is a "Sprint" that follows the **Spec-Gate** protocol. 

---

# 🔒 THE SPEC-GATE PROTOCOL
Before any Phase is considered "Complete," it must pass through this automated pipeline:
1. **Task Execution:** Write the code.
2. **Standardization:** Validate against **GitHub Spec-Kit**.
3. **Quality Audit:** SDK-based code review & Linting.
4. **Integration Test:** Ensure 0-regressions.
5. **Auto-Deploy:** Push to the Swarm & Update Docs.

---

# PHASE 0: THE FACTORY & DEV-SDK INITIALIZATION
**Goal:** Build the development tools and "Spec-Gate" pipeline before any core code.

### Task 0.1: Tanzil Dev-SDK Implementation 🔴 P0
- **Step 1:** Create `devtools/` folder.
- **Step 2:** Build `tanzil-dev.py` CLI with the following commands:
    - `review`: Python linting (Ruff/Flake8) and style check.
    - `validate-spec`: GitHub Spec-Kit validation.
    - `test`: Pytest runner with coverage.
    - `ship`: Automated Git flow (commit, tag, push).
- **Step 3:** Setup GitHub Spec-Kit in the root folder.
- **DoD:** Running `./tanzil-dev.py --help` returns all commands; `spec-kit` is initialized.

### Task 0.2: GitHub Actions (The Production Pipeline) 🔴 P0
- **Step 1:** Create `.github/workflows/production_pipeline.yml`.
- **Step 2:** Implement the CI/CD "Spec-Gate" (Tests -> Spec Validation -> Auto-Deploy).
- **Step 3:** Configure GitHub Pages for "Auto-Doc" generation.
- **DoD:** A test push to a `dev` branch triggers the full pipeline; status is green.

---

# PHASE 1: THE CORE ENGINE (COMPONENT A)
> **Spec-Gate Required**

### Task 1.1: Database Bedrock (Spec-Compliant) 🔴 P0
- **Step 1:** Implement SQL Schema.
- **Step 2:** Validate Schema against Spec-Kit models.
- **DoD:** Schema matches the global Tanzil specification.

### Task 1.2: Typed Shared Models 🔴 P0
- **Step 1:** Create Python `Pydantic` models for every table in `src/tanzil/shared/models.py`.
- **Step 2:** Implement `Enums` for all status fields (e.g., `JobStatus`, `DeliveryStatus`).
- **DoD:** Models can be imported by both `engine` and `bot` without circular dependencies.

---

# PHASE 2: THE TANZIL ENGINE (CORE EXTRACTION)
**Goal:** Build the sovereign extraction and processing engine.

### Task 2.1: The yt-dlp Wrapper 🔴 P0
- **Step 1:** Create `engine/extractor.py`.
- **Step 2:** Implement `probe(url)` to return structured metadata.
- **Step 3:** Implement `download(url, quality)` with deterministic output paths.
- **DoD:** Unit test: `probe("https://youtube.com/watch?v=...")` returns valid JSON with title and formats.

### Task 2.2: The Swarm Worker Logic 🔴 P0
- **Step 1:** Implement the "Atomic Claim" SQL (§7.5) in `engine/worker.py`.
- **Step 2:** Implement the state machine transitions (§7.1).
- **Step 3:** Implement local file cleanup (§16.3).
- **DoD:** A mock worker can claim a job from the DB, move it to `probing`, and then `processing`.

---

# PHASE 3: THE UNIVERSAL API & AI LAYER
**Goal:** Build the bridge and the intelligence.

### Task 3.1: Service Layer API 🔴 P0
- **Step 1:** Implement `api/service.py` with `probe`, `create_job`, and `get_status` methods (§13.5).
- **Step 2:** Implement the Internal Auth (Section 13.6).
- **DoD:** Internal calls from `bot` to `api` return correct job IDs.

### Task 3.2: AI Metadata Enrichment 🟡 P1
- **Step 1:** Integrate Hugging Face `InferenceClient` in `engine/ai_intelligence.py`.
- **Step 2:** Implement `SmartSummary` and `AutoTranslation` tasks.
- **DoD:** A job row is populated with a valid `ai_summary` after download.

---

# PHASE 4: THE TELEGRAM BOT (THE PRO CLIENT)
**Goal:** Build the world-class bot interface.

### Task 4.1: The Command Handler 🔴 P0
- **Step 1:** Setup `aiogram 3.x`.
- **Step 2:** Implement `/start`, `/help`, `/settings`.
- **Step 3:** Implement the URL Ingress (Normalization -> Session -> API Call).
- **DoD:** Bot responds to a URL with a "Checking..." message and a quality keyboard.

### Task 4.2: Ultra-UX Components 🟡 P1
- **Step 1:** Implement the dynamic progress bar formatter.
- **Step 2:** Implement the bilingual message catalog (§22.2).
- **Step 3:** Implement the "Zero-Typing" keyboard navigation.
- **DoD:** User can complete a full download cycle using only buttons.

---

# PHASE 5: THE TELEGRAM MINI-APP (TMA) BRIDGE
**Goal:** Build the native-like web interface inside Telegram.

### Task 5.1: TMA Setup & Auth 🟢 P2
- **Step 1:** Setup React + Vite in `clients/tma/`.
- **Step 2:** Implement `initData` verification in the API (§13.6).
- **Step 3:** Create the "Rich Media Browser" (User history display).
- **DoD:** Opening the TMA from the Bot shows the user's past downloads.

---

# PHASE 6: DEPLOYMENT & PRODUCTION
**Goal:** Go live and activate self-healing.

### Task 6.1: Swarm Deployment 🔴 P0
- **Step 1:** Deploy Control Plane to **Hugging Face Spaces** (Always-on).
- **Step 2:** Deploy Worker(s) to **Koyeb/Render** (Ephemeral).
- **Step 3:** Setup health check pinging (UptimeRobot).
- **DoD:** `/health` returns `ok` from both CP and Worker.

### Task 6.2: Lazarus Activation 🔴 P0
- **Step 1:** Implement the daily DB backup task (§12.11).
- **Step 2:** Verify "Bootstrap Restore" functionality on a clean environment.
- **DoD:** A manual restore from the Backup Channel successfully recovers all 23 tables.

---

# PHASE 7: PRODUCTION LAUNCH
**Goal:** Zero-Routine Maintenance steady state.

### Task 7.1: Final Sanity Check 🔴 P0
- **Step 1:** Run full E2E test suite (YT, IG, TikTok).
- **Step 2:** Verify Daily Limit reset (§6.4).
- **Step 3:** Verify Sentinel PoW for the API.
- **DoD:** Project launched to audience; Alerts group is quiet.
