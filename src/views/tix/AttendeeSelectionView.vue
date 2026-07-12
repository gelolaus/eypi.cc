<template>
  <section class="relative mx-auto w-full max-w-4xl px-4 py-16">

    <!-- Header -->
    <div class="mb-8">
      <router-link to="/manage/tix" class="mb-4 inline-block text-sm font-medium text-gray-400 hover:text-[#34418F] dark:text-slate-500 dark:hover:text-slate-300">← My events</router-link>
      <h1
        class="font-mono font-black tracking-tight text-[#34418F] dark:text-slate-200"
        style="font-size: clamp(1.6rem, 4vw, 2.5rem); letter-spacing: -0.03em;"
      >
        Attendee Selection
      </h1>
      <p v-if="eventName" class="mt-1 text-sm text-gray-500 dark:text-slate-400">{{ eventName }}</p>
    </div>

    <!-- Step progress bar -->
    <div class="mb-8 flex items-center gap-1">
      <template v-for="(_step, i) in visibleSteps" :key="i">
        <div
          :class="[
            'h-1.5 flex-1 rounded-full transition-all duration-300',
            stepIndex >= i ? 'bg-[#34418F] dark:bg-slate-400' : 'bg-gray-200 dark:bg-slate-700',
          ]"
        />
      </template>
    </div>
    <p class="mb-6 text-xs font-medium text-gray-400 dark:text-slate-500">
      Step {{ stepIndex + 1 }} of {{ visibleSteps.length }}
    </p>

    <!-- ─── STEP 1: UPLOAD ─────────────────────────────────────────────── -->
    <div v-if="currentStep === 'upload'" class="mica-card relative rounded-3xl border border-gray-200 dark:border-slate-600 p-8">
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Upload Spreadsheet</h2>
      <p class="mb-6 font-mono text-xs text-gray-500 dark:text-slate-400">Upload your respondents spreadsheet (.xlsx). Any column layout is accepted — you'll map the columns next.</p>

      <div
        class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors"
        :class="csvFile
          ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-900/10'
          : 'border-gray-300 bg-white/40 hover:border-[#34418F] dark:border-slate-600 dark:bg-mica-navy-input dark:hover:border-slate-500'"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <p v-if="csvFile" class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {{ csvFile.name }} — {{ allRows.length }} rows, {{ columnHeaders.length }} columns
        </p>
        <template v-else>
          <p class="text-sm text-gray-500 dark:text-slate-400">Drop .xlsx or click to upload</p>
        </template>
        <input ref="fileInput" type="file" accept=".xlsx" class="hidden" @change="onFileChange" />
        <button
          type="button"
          class="mt-3 rounded-lg border border-gray-300 bg-white px-4 py-1.5 font-mono text-xs text-gray-600 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:bg-transparent dark:text-slate-400 dark:hover:border-slate-400"
          @click="fileInput?.click()"
        >
          {{ csvFile ? 'Change file' : 'Browse' }}
        </button>
      </div>
      <p v-if="csvError" class="mt-2 text-xs font-medium text-red-500">{{ csvError }}</p>

      <button
        :disabled="!csvFile || !allRows.length || uploading"
        :class="[
          'mt-6 w-full rounded-xl bg-[#34418F] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 dark:bg-slate-700',
          (!csvFile || !allRows.length || uploading) ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110 hover:-translate-y-0.5',
        ]"
        @click="uploadCsv"
      >
        {{ uploading ? 'Uploading…' : 'Upload Spreadsheet & Continue →' }}
      </button>
    </div>

    <!-- ─── STEP 2: MAP COLUMNS ────────────────────────────────────────── -->
    <div v-else-if="currentStep === 'map-columns'" class="mica-card relative rounded-3xl border border-gray-200 dark:border-slate-600 p-8">
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Map Columns</h2>
      <p class="mb-6 font-mono text-xs text-gray-500 dark:text-slate-400">One column must be the attendee's email.</p>

      <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-slate-600">
        <div class="grid grid-cols-2 border-b border-gray-100 bg-gray-50/60 px-4 py-2 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-[#34418F] dark:border-slate-700 dark:bg-mica-navy-header dark:text-slate-400">
          <span>Column</span><span>Role</span>
        </div>
        <div
          v-for="col in columnHeaders"
          :key="col"
          class="grid grid-cols-2 items-center border-b border-gray-100 px-4 py-2.5 last:border-0 dark:border-slate-700/60"
        >
          <span class="truncate font-mono text-xs text-gray-700 dark:text-slate-300 pr-2">{{ col }}</span>
          <select
            :value="getColRole(col)"
            class="rounded-lg border border-gray-200 bg-white px-2 py-1.5 font-mono text-xs outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            @change="setColRole(col, ($event.target as HTMLSelectElement).value)"
          >
            <option value="criteria">Criteria</option>
            <option value="email">Email</option>
            <option value="first_name">First Name</option>
            <option value="last_name">Last Name</option>
            <option value="full_name">Full Name</option>
            <option value="cluster">Cluster / Group</option>
            <option value="ignore">Ignore</option>
          </select>
        </div>
      </div>

      <p v-if="mapError" class="mt-3 text-xs font-medium text-red-500">{{ mapError }}</p>

      <div class="mt-6 flex gap-3">
        <button class="rounded-xl border border-gray-200 px-4 py-3 text-xs font-mediumr text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-400" @click="currentStep = 'upload'">← Back</button>
        <button
          class="flex-1 rounded-xl bg-[#34418F] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 dark:bg-slate-700"
          @click="confirmMapping"
        >
          Continue →
        </button>
      </div>
    </div>

    <!-- ─── STEP 3: CLUSTERS ──────────────────────────────────────────── -->
    <div v-else-if="currentStep === 'clusters'" class="mica-card relative rounded-3xl border border-gray-200 dark:border-slate-600 p-8">
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Configure Clusters</h2>
      <p class="mb-1 font-mono text-xs text-gray-500 dark:text-slate-400">
        Column: <span class="font-bold text-[#34418F] dark:text-slate-300">{{ columnMapping?.clusterCol }}</span>
      </p>
      <p class="mb-6 font-mono text-xs text-gray-400 dark:text-slate-500">Set how many attendees each group can have. Total capacity is the sum of all quotas.</p>

      <div class="space-y-3">
        <div
          v-for="cl in clusters"
          :key="cl.value"
          class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white/50 px-4 py-3 dark:border-slate-600 dark:bg-mica-navy-input"
        >
          <div class="flex-1">
            <p class="font-mono text-sm font-bold text-gray-800 dark:text-slate-200">{{ cl.value }}</p>
            <p class="font-mono text-[0.65rem] text-gray-400 dark:text-slate-500 uppercase tracking-wide">{{ clusterRawCount(cl.value) }} respondents</p>
          </div>
          <div class="flex items-center gap-2">
            <label class="font-mono text-xs text-gray-500 dark:text-slate-400">Max:</label>
            <input
              :value="cl.maxCount"
              type="number"
              min="0"
              class="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1.5 font-mono text-sm font-bold text-center outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              @input="cl.maxCount = Math.max(0, parseInt(($event.target as HTMLInputElement).value) || 0)"
            />
          </div>
        </div>
      </div>

      <div class="mt-4 rounded-xl bg-gray-50 px-4 py-3 dark:bg-slate-800/50">
        <p class="font-mono text-xs text-gray-600 dark:text-slate-400">
          Total capacity: <span class="font-bold text-[#34418F] dark:text-slate-200">{{ totalClusterMax }}</span> attendees
        </p>
      </div>

      <p v-if="clusterError" class="mt-3 text-xs font-medium text-red-500">{{ clusterError }}</p>

      <div class="mt-6 flex gap-3">
        <button class="rounded-xl border border-gray-200 px-4 py-3 text-xs font-mediumr text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-400" @click="currentStep = 'map-columns'">← Back</button>
        <button
          :disabled="savingClusters"
          :class="[
            'flex-1 rounded-xl bg-[#34418F] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 dark:bg-slate-700',
            savingClusters ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110 hover:-translate-y-0.5',
          ]"
          @click="saveClusters"
        >
          {{ savingClusters ? 'Saving…' : 'Continue →' }}
        </button>
      </div>
    </div>

    <!-- ─── STEP 4: CLUSTER FILTERS (or global filter if no clusters) ─── -->
    <div v-else-if="currentStep === 'cluster-filter' || currentStep === 'filter'" class="mica-card relative rounded-3xl border border-gray-200 dark:border-slate-600 p-8">
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Selection Criteria</h2>
      <p class="mb-6 font-mono text-xs text-gray-500 dark:text-slate-400">
        Check the answer values you want to <span class="font-bold">include</span> in the raffle. Unchecked = excluded. Empty column = no filter applied.
      </p>

      <!-- Cluster-aware filter accordion -->
      <template v-if="clusters.length">
        <div v-for="cl in clusters" :key="cl.value" class="mb-4 overflow-hidden rounded-xl border border-gray-200 dark:border-slate-600">
          <button
            class="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/40"
            @click="toggleClusterOpen(cl.value)"
          >
            <div>
              <p class="font-mono text-sm font-bold text-gray-800 dark:text-slate-200">{{ cl.value }}</p>
              <p class="text-xs font-medium text-gray-400 dark:text-slate-500">
                max {{ cl.maxCount }} · {{ clusterEligibleCount(cl.value) }} eligible of {{ clusterRawCount(cl.value) }} total
              </p>
            </div>
            <span class="font-mono text-xs text-gray-400 dark:text-slate-500">{{ openClusters.has(cl.value) ? '▲' : '▼' }}</span>
          </button>

          <div v-if="openClusters.has(cl.value)" class="border-t border-gray-100 px-4 py-4 dark:border-slate-700">
            <div v-if="!criteriaColumns.length" class="font-mono text-xs text-gray-400 dark:text-slate-500">No criteria columns configured.</div>
            <div v-for="col in criteriaColumns" :key="col" class="mb-4 last:mb-0">
              <p class="mb-2 text-sm font-semibold text-gray-600 dark:text-slate-400">{{ col }}</p>
              <div class="flex flex-wrap gap-2">
                <label
                  v-for="val in uniqueValuesForCluster(col, cl.value)"
                  :key="val"
                  class="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors"
                  :class="isChecked(cl.value, col, val)
                    ? 'border-[#34418F] bg-[#34418F]/10 dark:border-slate-400 dark:bg-slate-700/50'
                    : 'border-gray-200 bg-white/60 hover:border-gray-300 dark:border-slate-600 dark:bg-mica-navy-input'"
                >
                  <input
                    type="checkbox"
                    :checked="isChecked(cl.value, col, val)"
                    class="h-3.5 w-3.5 accent-[#34418F]"
                    @change="toggleFilter(cl.value, col, val)"
                  />
                  <span class="font-mono text-xs text-gray-700 dark:text-slate-300">{{ val }}</span>
                  <span class="font-mono text-[0.6rem] text-gray-400 dark:text-slate-500">({{ countInCluster(col, val, cl.value) }})</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- No-cluster global filter -->
      <template v-else>
        <div v-for="col in criteriaColumns" :key="col" class="mb-6 last:mb-0">
          <p class="mb-2 text-sm font-semibold text-gray-600 dark:text-slate-400">{{ col }}</p>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="val in uniqueValues(col)"
              :key="val"
              class="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors"
              :class="isChecked(null, col, val)
                ? 'border-[#34418F] bg-[#34418F]/10 dark:border-slate-400 dark:bg-slate-700/50'
                : 'border-gray-200 bg-white/60 hover:border-gray-300 dark:border-slate-600 dark:bg-mica-navy-input'"
            >
              <input
                type="checkbox"
                :checked="isChecked(null, col, val)"
                class="h-3.5 w-3.5 accent-[#34418F]"
                @change="toggleFilter(null, col, val)"
              />
              <span class="font-mono text-xs text-gray-700 dark:text-slate-300">{{ val }}</span>
              <span class="font-mono text-[0.6rem] text-gray-400 dark:text-slate-500">({{ countInAll(col, val) }})</span>
            </label>
          </div>
        </div>
        <div v-if="!criteriaColumns.length" class="font-mono text-xs text-gray-400 dark:text-slate-500">No criteria columns configured.</div>
      </template>

      <!-- Live summary -->
      <div class="mt-6 rounded-xl bg-gray-50 px-4 py-3 dark:bg-slate-800/50">
        <p class="font-mono text-xs text-gray-600 dark:text-slate-400">
          Total eligible: <span class="font-bold text-[#34418F] dark:text-slate-200">{{ totalEligible }}</span>
        </p>
      </div>

      <div class="mt-6 flex gap-3">
        <button class="rounded-xl border border-gray-200 px-4 py-3 text-xs font-mediumr text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-400" @click="backFromFilter">← Back</button>
        <button
          class="flex-1 rounded-xl bg-[#34418F] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 dark:bg-slate-700"
          @click="currentStep = 'guarantee'"
        >
          Continue →
        </button>
      </div>
    </div>

    <!-- ─── STEP 5: GUARANTEE ─────────────────────────────────────────── -->
    <div v-else-if="currentStep === 'guarantee'" class="mica-card relative rounded-3xl border border-gray-200 dark:border-slate-600 p-8">
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Manual Guarantees</h2>
      <p class="mb-6 font-mono text-xs text-gray-500 dark:text-slate-400">Add specific people who are guaranteed a slot regardless of the raffle. These reduce the available raffle slots.</p>

      <!-- Search -->
      <div class="mb-4">
        <input
          v-model="guaranteeSearch"
          type="text"
          placeholder="Search by name or email…"
          class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400"
        />
      </div>

      <!-- Search results -->
      <div v-if="guaranteeSearch.trim() && guaranteeSearchResults.length" class="mb-4 max-h-52 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-600">
        <div
          v-for="row in guaranteeSearchResults"
          :key="row.id"
          class="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 last:border-0 dark:border-slate-700/60"
        >
          <div>
            <p class="font-mono text-sm text-gray-800 dark:text-slate-200">{{ getDisplayName(row) }}</p>
            <p class="font-mono text-xs text-gray-400 dark:text-slate-500">{{ getEmail(row) }}
              <span v-if="columnMapping?.clusterCol" class="ml-2 rounded bg-[#34418F]/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-[#34418F] dark:bg-slate-700 dark:text-slate-300">
                {{ row.rawData[columnMapping.clusterCol] ?? '—' }}
              </span>
            </p>
          </div>
          <button
            v-if="!guaranteedRowIds.has(row.id)"
            class="rounded-lg bg-[#34418F] px-3 py-1 font-mono text-xs text-white transition-colors hover:brightness-110 dark:bg-slate-600"
            @click="addGuarantee(row.id)"
          >
            Add
          </button>
          <span v-else class="font-mono text-xs text-emerald-500">Added ✓</span>
        </div>
      </div>
      <div v-else-if="guaranteeSearch.trim() && !guaranteeSearchResults.length" class="mb-4 font-mono text-xs text-gray-400 dark:text-slate-500">No matches found.</div>

      <!-- Guaranteed list -->
      <div v-if="guaranteedRowIds.size" class="mb-4">
        <p class="mb-2 text-data text-xs font-semibold text-gray-500 dark:text-slate-400">Guaranteed ({{ guaranteedRowIds.size }})</p>
        <div class="max-h-52 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-600">
          <div
            v-for="rowId in [...guaranteedRowIds]"
            :key="rowId"
            class="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 last:border-0 dark:border-slate-700/60"
          >
            <div>
              <p class="font-mono text-sm text-gray-800 dark:text-slate-200">{{ getDisplayName(rowById(rowId)) }}</p>
              <p class="font-mono text-xs text-gray-400 dark:text-slate-500">{{ getEmail(rowById(rowId)) }}
                <span v-if="columnMapping?.clusterCol && rowById(rowId)" class="ml-2 rounded bg-[#34418F]/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-[#34418F] dark:bg-slate-700 dark:text-slate-300">
                  {{ rowById(rowId)!.rawData[columnMapping!.clusterCol!] ?? '—' }}
                </span>
              </p>
            </div>
            <button
              class="rounded-lg border border-red-200 px-2 py-1 font-mono text-xs text-red-500 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/10"
              @click="removeGuarantee(rowId)"
            >✕</button>
          </div>
        </div>
      </div>
      <p v-else class="mb-4 font-mono text-xs text-gray-400 dark:text-slate-500">No guaranteed attendees yet.</p>

      <div class="mt-2 flex gap-3">
        <button class="rounded-xl border border-gray-200 px-4 py-3 text-xs font-mediumr text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-400" @click="backFromGuarantee">← Back</button>
        <button
          class="flex-1 rounded-xl bg-[#34418F] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 dark:bg-slate-700"
          @click="currentStep = 'confirm'"
        >
          Continue →
        </button>
      </div>
    </div>

    <!-- ─── STEP 6: CONFIRM ───────────────────────────────────────────── -->
    <div v-else-if="currentStep === 'confirm'" class="mica-card relative rounded-3xl border border-gray-200 dark:border-slate-600 p-8">
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

      <h2 class="mb-1 text-sm font-semibold text-[#34418F] dark:text-slate-300">Confirm & Generate</h2>
      <p class="mb-6 font-mono text-xs text-gray-500 dark:text-slate-400">Once you finalize, QR codes will be generated and downloaded.</p>

      <!-- Max attendees edit -->
      <div class="mb-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-white/50 px-4 py-3 dark:border-slate-600 dark:bg-mica-navy-input">
        <label class="text-sm font-semibold text-gray-600 dark:text-slate-400">Max Attendees:</label>
        <input
          v-model.number="maxAttendeesEdit"
          type="number"
          min="1"
          placeholder="Unlimited"
          class="w-28 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-mono text-sm font-bold outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
        <span class="font-mono text-[0.65rem] text-gray-400 dark:text-slate-500">(auto-sum from clusters: {{ totalClusterMax || '—' }})</span>
      </div>

      <!-- Cluster summary table -->
      <div v-if="clusters.length" class="mb-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-600">
        <div class="min-w-[520px]">
        <div class="text-data grid grid-cols-5 border-b border-gray-100 bg-gray-50/60 px-4 py-2 text-xs font-semibold text-[#34418F] dark:border-slate-700 dark:bg-mica-navy-header dark:text-slate-400">
          <span class="col-span-2">Cluster</span>
          <span class="text-center">Quota</span>
          <span class="text-center">Guaranteed</span>
          <span class="text-center">Raffle pool</span>
        </div>
        <div
          v-for="cl in clusters"
          :key="cl.value"
          class="grid grid-cols-5 items-center border-b border-gray-100 px-4 py-3 last:border-0 dark:border-slate-700/60"
        >
          <span class="col-span-2 font-mono text-sm font-bold text-gray-800 dark:text-slate-200">{{ cl.value }}</span>
          <span class="text-center font-mono text-sm text-gray-700 dark:text-slate-300">{{ cl.maxCount }}</span>
          <span class="text-center font-mono text-sm text-gray-700 dark:text-slate-300">{{ guaranteedCountForCluster(cl.value) }}</span>
          <div class="text-center">
            <span class="font-mono text-sm text-gray-700 dark:text-slate-300">{{ rafflePoolForCluster(cl.value) }}</span>
            <p
              v-if="needsRaffleForCluster(cl.value)"
              class="font-mono text-[0.6rem] text-amber-500 uppercase tracking-wide"
            >raffle</p>
            <p v-else-if="unfilledSlotsForCluster(cl.value) > 0" class="font-mono text-[0.6rem] text-blue-400 uppercase tracking-wide">
              {{ unfilledSlotsForCluster(cl.value) }} unfilled
            </p>
            <p v-else class="font-mono text-[0.6rem] text-emerald-500 uppercase tracking-wide">all fit</p>
          </div>
        </div>
        </div>
      </div>

      <!-- No-cluster summary -->
      <div v-else class="mb-6 grid grid-cols-3 gap-3">
        <div class="rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-center dark:border-slate-600 dark:bg-mica-navy-input">
          <p class="font-mono text-2xl font-black text-[#34418F] dark:text-slate-200">{{ guaranteedRowIds.size }}</p>
          <p class="font-mono text-[0.6rem] uppercase tracking-widest text-gray-400 dark:text-slate-500">Guaranteed</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-center dark:border-slate-600 dark:bg-mica-navy-input">
          <p class="font-mono text-2xl font-black text-[#34418F] dark:text-slate-200">{{ globalEligibleRows.length }}</p>
          <p class="font-mono text-[0.6rem] uppercase tracking-widest text-gray-400 dark:text-slate-500">Eligible</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white/50 px-4 py-3 text-center dark:border-slate-600 dark:bg-mica-navy-input">
          <p class="font-mono text-2xl font-black text-[#34418F] dark:text-slate-200">{{ maxAttendeesEdit ?? '∞' }}</p>
          <p class="font-mono text-[0.6rem] uppercase tracking-widest text-gray-400 dark:text-slate-500">Max slots</p>
        </div>
      </div>

      <!-- Unfilled warning -->
      <div v-if="hasUnfilledClusters" class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-mono text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-400">
        Some clusters have fewer eligible respondents than their quota — those slots will remain unfilled. You can re-raffle after finalization once more respondents are available.
      </div>

      <div class="mt-2 flex gap-3">
        <button class="rounded-xl border border-gray-200 px-4 py-3 text-xs font-mediumr text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-400" @click="currentStep = 'guarantee'">← Back</button>
        <button
          :disabled="finalizing"
          :class="[
            'flex-1 rounded-xl bg-[#DEAC4B] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 dark:bg-eypi-gold-dark',
            finalizing ? 'opacity-50 cursor-not-allowed animate-pulse' : 'hover:brightness-110 hover:-translate-y-0.5',
          ]"
          @click="finalize"
        >
          {{ finalizingLabel }}
        </button>
      </div>
    </div>

  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import { TIX_API_URL } from '@/config/tix-api'
import { TIX_QR_RENDER_OPTIONS } from '@/utils/tix-qr'
import type { CsvRow, ColumnMapping, ClusterConfig } from '@/types/selection'

const route  = useRoute()
const router = useRouter()
const toast  = useToast()
const { authHeaders } = useAuth()

const slug = route.params.id as string

// ── event meta ────────────────────────────────────────────────────────────────
const eventName = ref('')

// ── wizard state ──────────────────────────────────────────────────────────────
type Step = 'upload' | 'map-columns' | 'clusters' | 'cluster-filter' | 'filter' | 'guarantee' | 'confirm'
const currentStep = ref<Step>('upload')

const STEP_META: Record<Step, string> = {
  'upload':         'Upload CSV',
  'map-columns':    'Map Columns',
  'clusters':       'Configure Clusters',
  'cluster-filter': 'Criteria',
  'filter':         'Criteria',
  'guarantee':      'Guarantees',
  'confirm':        'Confirm',
}

// Steps we actually display in the progress bar
const visibleSteps = computed(() => {
  const hasClusters = !!columnMapping.value?.clusterCol
  const keys: Step[] = hasClusters
    ? ['upload', 'map-columns', 'clusters', 'cluster-filter', 'guarantee', 'confirm']
    : ['upload', 'map-columns', 'filter', 'guarantee', 'confirm']
  return keys.map(k => ({ key: k, label: STEP_META[k] }))
})
const stepIndex = computed(() => visibleSteps.value.findIndex(s => s.key === currentStep.value))

// ── CSV upload ────────────────────────────────────────────────────────────────
const csvFile   = ref<File | null>(null)
const csvError  = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const allRows   = ref<CsvRow[]>([])
const columnHeaders = ref<string[]>([])

// ── column mapping ────────────────────────────────────────────────────────────
const columnMapping = ref<ColumnMapping | null>(null)
const colRoles      = ref<Record<string, string>>({})
const mapError      = ref('')

function getColRole(col: string): string {
  return colRoles.value[col] ?? 'criteria'
}
function setColRole(col: string, role: string) {
  // Only one email col, first/last/full, cluster allowed
  if (role === 'email') {
    for (const k of Object.keys(colRoles.value)) {
      if (colRoles.value[k] === 'email') colRoles.value[k] = 'criteria'
    }
  }
  if (role === 'cluster') {
    for (const k of Object.keys(colRoles.value)) {
      if (colRoles.value[k] === 'cluster') colRoles.value[k] = 'criteria'
    }
  }
  colRoles.value[col] = role
}

function buildMapping(): ColumnMapping {
  const roles = colRoles.value
  const emailCol     = Object.keys(roles).find(k => roles[k] === 'email') ?? columnHeaders.value[0]
  const firstNameCol = Object.keys(roles).find(k => roles[k] === 'first_name') ?? null
  const lastNameCol  = Object.keys(roles).find(k => roles[k] === 'last_name')  ?? null
  const fullNameCol  = Object.keys(roles).find(k => roles[k] === 'full_name')  ?? null
  const clusterCol   = Object.keys(roles).find(k => roles[k] === 'cluster')    ?? null
  const criteriaColumns = Object.keys(roles).filter(k => roles[k] === 'criteria')
  return { emailCol, firstNameCol, lastNameCol, fullNameCol, clusterCol, criteriaColumns }
}

function autoDetectRoles(headers: string[]): Record<string, string> {
  const n = (h: string) => h.toLowerCase().replace(/[\s_"'.?()-]/g, '')
  const roles: Record<string, string> = {}
  for (const h of headers) {
    const norm = n(h)
    if (norm.includes('email')) roles[h] = 'email'
    else if (['firstname', 'first', 'givenname'].includes(norm)) roles[h] = 'first_name'
    else if (['lastname', 'last', 'surname', 'familyname'].includes(norm)) roles[h] = 'last_name'
    else if (['fullname', 'name', 'completename'].includes(norm)) roles[h] = 'full_name'
    else roles[h] = 'criteria'
  }
  return roles
}

// ── XLSX parsing ──────────────────────────────────────────────────────────────
async function parseXlsx(buffer: ArrayBuffer): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })

  if (raw.length < 2) throw new Error('File must have a header row and at least one data row.')

  const headers = (raw[0] as unknown[])
    .map(h => String(h ?? '').trim())
    .filter(Boolean)

  const rows = (raw.slice(1) as unknown[][])
    .filter(row => row.some(cell => cell !== '' && cell !== undefined && cell !== null))
    .map(row => {
      const obj: Record<string, string> = {}
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]] = String(row[i] ?? '').trim()
      }
      return obj
    })

  return { headers, rows }
}

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file) loadFile(file)
}
function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) loadFile(file)
}
function loadFile(file: File) {
  csvError.value = ''
  if (!file.name.endsWith('.xlsx')) {
    csvError.value = 'Please upload an .xlsx file.'
    return
  }
  const reader = new FileReader()
  reader.onload = async ev => {
    try {
      const { headers, rows } = await parseXlsx(ev.target?.result as ArrayBuffer)
      if (!rows.length) throw new Error('No data rows found in the spreadsheet.')
      csvFile.value = file
      columnHeaders.value = headers
      allRows.value = rows.map((rawData, i) => ({ id: '', rowIndex: i, rawData }))
      colRoles.value = autoDetectRoles(headers)
    } catch (err: unknown) {
      csvError.value = err instanceof Error ? err.message : 'Invalid file.'
      csvFile.value = null
      allRows.value = []
    }
  }
  reader.readAsArrayBuffer(file)
}

async function uploadCsv() {
  if (!allRows.value.length) return
  uploading.value = true
  try {
    const mapping = buildMapping()
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}/upload-csv`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ rows: allRows.value.map(r => r.rawData), columnMapping: mapping }),
    })
    const data = await res.json() as { status: string; message?: string; rowIds?: string[] }
    if (!res.ok) throw new Error(data.message ?? 'Upload failed.')
    if (data.rowIds) {
      allRows.value = allRows.value.map((r, i) => ({ ...r, id: data.rowIds![i] ?? r.id }))
    }
    columnMapping.value = mapping
    currentStep.value = 'map-columns'
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Upload failed.')
  } finally {
    uploading.value = false
  }
}

// ── mapping confirmation ──────────────────────────────────────────────────────
async function confirmMapping() {
  mapError.value = ''
  const emailCol = Object.keys(colRoles.value).find(k => colRoles.value[k] === 'email')
  if (!emailCol) { mapError.value = 'You must assign one column as Email.'; return }
  const mapping = buildMapping()
  columnMapping.value = mapping
  // Persist the confirmed mapping to DB so finalize uses the correct column names
  fetch(`${TIX_API_URL}/api/events/${slug}/column-mapping`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      emailCol:        mapping.emailCol,
      firstNameCol:    mapping.firstNameCol,
      lastNameCol:     mapping.lastNameCol,
      fullNameCol:     mapping.fullNameCol,
      clusterCol:      mapping.clusterCol,
      criteriaColumns: mapping.criteriaColumns,
    }),
  }).catch(() => { /* non-fatal; finalize body carries the mapping as well */ })
  currentStep.value = mapping.clusterCol ? 'clusters' : 'filter'
}

// ── clusters ──────────────────────────────────────────────────────────────────
const clusters      = ref<ClusterConfig[]>([])
const clusterError  = ref('')
const savingClusters = ref(false)
const openClusters  = ref<Set<string>>(new Set())

const totalClusterMax = computed(() => clusters.value.reduce((s, c) => s + (c.maxCount || 0), 0))

watch(() => columnMapping.value?.clusterCol, (col) => {
  if (!col) { clusters.value = []; return }
  // Build cluster list from unique values in that column
  const seen = new Set<string>()
  for (const row of allRows.value) {
    const v = row.rawData[col]?.trim()
    if (v) seen.add(v)
  }
  // Preserve existing maxCount/filters if cluster values haven't changed
  const existing = new Map(clusters.value.map(c => [c.value, c]))
  clusters.value = [...seen].map(v => existing.get(v) ?? { value: v, maxCount: 0, filters: {} })
})

function clusterRawCount(value: string): number {
  if (!columnMapping.value?.clusterCol) return 0
  const col = columnMapping.value.clusterCol
  return allRows.value.filter(r => r.rawData[col] === value).length
}

async function saveClusters() {
  clusterError.value = ''
  if (clusters.value.some(c => (c.maxCount ?? 0) <= 0)) {
    clusterError.value = 'All clusters must have a quota greater than 0.'
    return
  }
  savingClusters.value = true
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}/clusters`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        clusterCol: columnMapping.value!.clusterCol,
        clusters: clusters.value.map(c => ({ value: c.value, maxCount: c.maxCount, filters: c.filters })),
      }),
    })
    const data = await res.json() as { status: string; message?: string }
    if (!res.ok) throw new Error(data.message ?? 'Failed to save clusters.')
    currentStep.value = 'cluster-filter'
  } catch (err: unknown) {
    clusterError.value = err instanceof Error ? err.message : 'Failed to save.'
  } finally {
    savingClusters.value = false
  }
}

function toggleClusterOpen(value: string) {
  if (openClusters.value.has(value)) openClusters.value.delete(value)
  else openClusters.value.add(value)
}

// ── criteria filters ──────────────────────────────────────────────────────────
// Structure: Map<clusterValue | '__global__', Map<column, Set<allowedValues>>>
const filters = ref<Map<string, Map<string, Set<string>>>>(new Map())

const GLOBAL = '__global__'

function getFilterMap(clusterValue: string | null): Map<string, Set<string>> {
  const key = clusterValue ?? GLOBAL
  if (!filters.value.has(key)) filters.value.set(key, new Map())
  return filters.value.get(key)!
}

function isChecked(clusterValue: string | null, col: string, val: string): boolean {
  const m = getFilterMap(clusterValue)
  return m.get(col)?.has(val) ?? false
}

function toggleFilter(clusterValue: string | null, col: string, val: string) {
  const m = getFilterMap(clusterValue)
  if (!m.has(col)) m.set(col, new Set())
  const s = m.get(col)!
  if (s.has(val)) s.delete(val); else s.add(val)
  // Also update the ClusterConfig.filters for saving
  if (clusterValue) {
    const cl = clusters.value.find(c => c.value === clusterValue)
    if (cl) {
      if (!cl.filters[col]) cl.filters[col] = []
      if (s.has(val)) { if (!cl.filters[col].includes(val)) cl.filters[col].push(val) }
      else cl.filters[col] = cl.filters[col].filter(v => v !== val)
    }
  }
}

const criteriaColumns = computed(() => columnMapping.value?.criteriaColumns ?? [])

function uniqueValues(col: string): string[] {
  const seen = new Set<string>()
  for (const r of allRows.value) { const v = r.rawData[col]?.trim(); if (v) seen.add(v) }
  return [...seen].sort()
}

function uniqueValuesForCluster(col: string, clusterValue: string): string[] {
  if (!columnMapping.value?.clusterCol) return uniqueValues(col)
  const clusterCol = columnMapping.value.clusterCol
  const seen = new Set<string>()
  for (const r of allRows.value) {
    if (r.rawData[clusterCol] !== clusterValue) continue
    const v = r.rawData[col]?.trim(); if (v) seen.add(v)
  }
  return [...seen].sort()
}

function countInAll(col: string, val: string): number {
  return allRows.value.filter(r => r.rawData[col] === val).length
}

function countInCluster(col: string, val: string, clusterValue: string): number {
  if (!columnMapping.value?.clusterCol) return countInAll(col, val)
  const cc = columnMapping.value.clusterCol
  return allRows.value.filter(r => r.rawData[cc] === clusterValue && r.rawData[col] === val).length
}

function rowPassesFilters(row: CsvRow, clusterValue: string | null): boolean {
  const m = getFilterMap(clusterValue)
  for (const [col, vals] of m.entries()) {
    if (vals.size > 0 && !vals.has(row.rawData[col] ?? '')) return false
  }
  return true
}

function clusterEligibleCount(clusterValue: string): number {
  if (!columnMapping.value?.clusterCol) return 0
  const cc = columnMapping.value.clusterCol
  return allRows.value.filter(r => r.rawData[cc] === clusterValue && rowPassesFilters(r, clusterValue)).length
}

const globalEligibleRows = computed(() => {
  if (clusters.value.length) return []
  return allRows.value.filter(r => rowPassesFilters(r, null))
})

const totalEligible = computed(() => {
  if (clusters.value.length) return clusters.value.reduce((s, c) => s + clusterEligibleCount(c.value), 0)
  return globalEligibleRows.value.length
})

function backFromFilter() {
  currentStep.value = columnMapping.value?.clusterCol ? 'clusters' : 'map-columns'
}

// ── guarantee ─────────────────────────────────────────────────────────────────
const guaranteeSearch        = ref('')
const guaranteedRowIds       = ref<Set<string>>(new Set())
const guaranteeSearchResults = computed(() => {
  const q = guaranteeSearch.value.trim().toLowerCase()
  if (!q) return []
  return allRows.value.filter(r => {
    const name  = getDisplayName(r).toLowerCase()
    const email = getEmail(r).toLowerCase()
    return name.includes(q) || email.includes(q)
  }).slice(0, 20)
})

function getDisplayName(row: CsvRow | undefined): string {
  if (!row) return ''
  const m = columnMapping.value
  if (!m) return ''
  if (m.firstNameCol && m.lastNameCol) return `${row.rawData[m.firstNameCol] ?? ''} ${row.rawData[m.lastNameCol] ?? ''}`.trim()
  if (m.fullNameCol) return row.rawData[m.fullNameCol] ?? ''
  return ''
}
function getEmail(row: CsvRow | undefined): string {
  if (!row || !columnMapping.value) return ''
  return row.rawData[columnMapping.value.emailCol] ?? ''
}
function rowById(id: string): CsvRow | undefined {
  return allRows.value.find(r => r.id === id)
}
function addGuarantee(id: string) {
  guaranteedRowIds.value.add(id)
}
function removeGuarantee(id: string) {
  guaranteedRowIds.value.delete(id)
}

function backFromGuarantee() {
  currentStep.value = columnMapping.value?.clusterCol ? 'cluster-filter' : 'filter'
}

// ── confirm / summary ─────────────────────────────────────────────────────────
const maxAttendeesEdit = ref<number | null>(null)

watch(totalClusterMax, (v) => { if (v > 0) maxAttendeesEdit.value = v })

function clusterForRow(rowId: string): string | null {
  const row = rowById(rowId)
  if (!row || !columnMapping.value?.clusterCol) return null
  return row.rawData[columnMapping.value.clusterCol] ?? null
}
function guaranteedCountForCluster(clusterValue: string): number {
  return [...guaranteedRowIds.value].filter(id => clusterForRow(id) === clusterValue).length
}
function eligibleNonGuaranteedForCluster(clusterValue: string): CsvRow[] {
  if (!columnMapping.value?.clusterCol) return []
  const cc = columnMapping.value.clusterCol
  return allRows.value.filter(r =>
    r.rawData[cc] === clusterValue &&
    !guaranteedRowIds.value.has(r.id) &&
    rowPassesFilters(r, clusterValue)
  )
}
function rafflePoolForCluster(clusterValue: string): number {
  return eligibleNonGuaranteedForCluster(clusterValue).length
}
function remainingSlotsForCluster(clusterValue: string): number {
  const cl = clusters.value.find(c => c.value === clusterValue)
  if (!cl) return 0
  return Math.max(0, (cl.maxCount ?? 0) - guaranteedCountForCluster(clusterValue))
}
function needsRaffleForCluster(clusterValue: string): boolean {
  return rafflePoolForCluster(clusterValue) > remainingSlotsForCluster(clusterValue)
}
function unfilledSlotsForCluster(clusterValue: string): number {
  const pool = rafflePoolForCluster(clusterValue)
  const slots = remainingSlotsForCluster(clusterValue)
  return Math.max(0, slots - pool)
}
const hasUnfilledClusters = computed(() => clusters.value.some(c => unfilledSlotsForCluster(c.value) > 0))

// ── raffle algorithm ──────────────────────────────────────────────────────────
function fisherYates<T>(arr: T[]): T[] {
  const r = [...arr]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

function buildSelectedRows(): { rowId: string; clusterValue: string | null }[] {
  const selected: { rowId: string; clusterValue: string | null }[] = []

  if (clusters.value.length) {
    for (const cl of clusters.value) {
      // Guaranteed first
      const guaranteed = [...guaranteedRowIds.value].filter(id => clusterForRow(id) === cl.value)
      for (const id of guaranteed) selected.push({ rowId: id, clusterValue: cl.value })

      // Raffle from eligible non-guaranteed
      const pool = eligibleNonGuaranteedForCluster(cl.value)
      const slots = remainingSlotsForCluster(cl.value)
      const winners = slots >= pool.length ? pool : fisherYates(pool).slice(0, slots)
      for (const r of winners) selected.push({ rowId: r.id, clusterValue: cl.value })
    }
  } else {
    // No clusters: guaranteed + raffle from global eligible
    for (const id of guaranteedRowIds.value) selected.push({ rowId: id, clusterValue: null })
    const guaranteed = new Set(guaranteedRowIds.value)
    const pool = globalEligibleRows.value.filter(r => !guaranteed.has(r.id))
    const max = maxAttendeesEdit.value
    const slots = max !== null ? Math.max(0, max - guaranteed.size) : pool.length
    const winners = slots >= pool.length ? pool : fisherYates(pool).slice(0, slots)
    for (const r of winners) selected.push({ rowId: r.id, clusterValue: null })
  }

  // Deduplicate by rowId
  const seen = new Set<string>()
  return selected.filter(s => { if (seen.has(s.rowId)) return false; seen.add(s.rowId); return true })
}

// ── finalize ──────────────────────────────────────────────────────────────────
const finalizing      = ref(false)
const finalizingLabel = ref('Finalize & Generate QR Codes')

async function finalize() {
  finalizing.value = true
  finalizingLabel.value = 'Running raffle…'
  try {
    // If rows are missing server IDs (uploaded in this session without a refresh),
    // fetch them now before building the selected set.
    if (allRows.value.some(r => !r.id)) {
      const csvRes = await fetch(`${TIX_API_URL}/api/events/${slug}/csv-data`, { headers: authHeaders() })
      const csvData = await csvRes.json() as { status: string; rows: CsvRow[] }
      if (csvRes.ok && csvData.rows.length) allRows.value = csvData.rows
    }

    const selectedRows = buildSelectedRows()
    if (!selectedRows.length) throw new Error('No attendees selected.')

    finalizingLabel.value = 'Saving selection…'
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}/finalize`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        selectedRows,
        maxAttendees: maxAttendeesEdit.value ?? null,
        columnMapping: columnMapping.value ? {
          emailCol:     columnMapping.value.emailCol,
          firstNameCol: columnMapping.value.firstNameCol,
          lastNameCol:  columnMapping.value.lastNameCol,
          fullNameCol:  columnMapping.value.fullNameCol,
        } : undefined,
      }),
    })
    const data = await res.json() as { status: string; message?: string; attendees?: { id: string; firstName: string; lastName: string; email: string; qrToken: string; clusterValue: string | null }[] }
    if (!res.ok) throw new Error(data.message ?? 'Finalization failed.')

    const attendees = data.attendees!
    finalizingLabel.value = `Generating ${attendees.length} QR codes…`

    const { default: QRCodeStyling } = await import('qr-code-styling')
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    for (const a of attendees) {
      const qr = new QRCodeStyling({
        width: 400, height: 400, type: 'canvas',
        data: a.qrToken,
        ...TIX_QR_RENDER_OPTIONS,
      })
      const blob = await qr.getRawData('png')
      if (blob) {
        const name = `${a.firstName}_${a.lastName}`.replace(/[^a-zA-Z0-9_]/g, '_')
        zip.file(`${name}.png`, blob)
      }
    }

    finalizingLabel.value = 'Preparing ZIP…'
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const link = document.createElement('a')
    link.href = url
    link.download = `${slug}-tickets.zip`
    link.click()
    URL.revokeObjectURL(url)

    toast.success(`${attendees.length} tickets generated. Redirecting to event…`)
    router.push(`/manage/tix/${slug}`)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Finalization failed.')
    finalizingLabel.value = 'Finalize & Generate QR Codes'
  } finally {
    finalizing.value = false
  }
}

// ── onMounted: load event info + resume if CSV already uploaded ───────────────
onMounted(async () => {
  // Fetch event name
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}`, { headers: authHeaders() })
    const data = await res.json() as { status: string; event?: { name: string; isLead: boolean; selectionLocked: boolean } }
    if (res.ok && data.event) {
      eventName.value = data.event.name
      if (!data.event.isLead) { router.replace(`/manage/tix/${slug}`); return }
      if (data.event.selectionLocked) { router.replace(`/manage/tix/${slug}`); return }
    }
  } catch { /* ignore */ }

  // Try to resume from previously uploaded CSV
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}/csv-data`, { headers: authHeaders() })
    const data = await res.json() as {
      status: string
      columnMapping: ColumnMapping | null
      rows: CsvRow[]
      clusters: ClusterConfig[]
    }
    if (res.ok && data.rows.length) {
      allRows.value = data.rows
      if (data.rows.length) {
        // Reconstruct column headers from the first row's keys
        columnHeaders.value = Object.keys(data.rows[0].rawData)
      }
      if (data.columnMapping) {
        columnMapping.value = data.columnMapping
        // Reconstruct colRoles from mapping
        const m = data.columnMapping
        const roles: Record<string, string> = {}
        for (const h of columnHeaders.value) roles[h] = 'criteria'
        if (m.emailCol)     roles[m.emailCol]     = 'email'
        if (m.firstNameCol) roles[m.firstNameCol] = 'first_name'
        if (m.lastNameCol)  roles[m.lastNameCol]  = 'last_name'
        if (m.fullNameCol)  roles[m.fullNameCol]  = 'full_name'
        if (m.clusterCol)   roles[m.clusterCol]   = 'cluster'
        for (const c of (m.criteriaColumns ?? [])) roles[c] = 'criteria'
        colRoles.value = roles
      }
      if (data.clusters.length) {
        clusters.value = data.clusters
        currentStep.value = 'cluster-filter'
      } else if (data.columnMapping) {
        currentStep.value = 'filter'
      } else {
        currentStep.value = 'map-columns'
      }
    }
  } catch { /* fresh start */ }
})
</script>
