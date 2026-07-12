<template>
  <section class="relative mx-auto w-full max-w-5xl px-3 py-8 sm:px-6 sm:py-12">

    <div class="rounded-3xl bg-white/92 dark:bg-slate-900/95 backdrop-blur-sm shadow-[0_4px_40px_rgba(0,0,0,0.07)] ring-1 ring-black/5 dark:ring-white/[0.06] px-5 py-8 sm:px-8 sm:py-10">

    <!-- Loading -->
    <div v-if="loadingEvent" class="space-y-4">
      <div class="h-10 w-64 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-800/60" />
      <div class="h-4 w-40 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-800/60" />
    </div>

    <!-- Not found / forbidden -->
    <div v-else-if="!event" class="py-24 text-center">
      <p class="font-mono text-4xl font-black text-[#34418F] dark:text-slate-200">404</p>
      <p class="mt-2 text-sm text-gray-500 dark:text-slate-400">Event not found</p>
      <router-link to="/manage/tix" class="mt-6 inline-block text-sm font-medium text-[#DEAC4B] hover:underline">← My events</router-link>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            class="font-mono font-black tracking-tight text-[#34418F] dark:text-slate-200"
            style="font-size: clamp(1.8rem, 4.5vw, 3rem); letter-spacing: -0.03em;"
            data-cursor="text"
          >
            {{ event.name }}
          </h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-slate-400">
            {{ formatDate(event.eventDate) }} · {{ formatTime(event.eventTime) }} · {{ event.location }}
          </p>

          <!-- Capacity row -->
          <div v-if="event.isLead" class="mt-2 flex items-center gap-3 flex-wrap">
            <!-- Total capacity -->
            <div class="flex items-center gap-1.5">
              <span
                class="font-mono text-xs font-bold"
                :class="isAtCapacity ? 'text-red-500' : 'text-gray-500 dark:text-slate-400'"
              >
                {{ activeAttendeeCount }}{{ event.maxAttendees ? ` / ${event.maxAttendees}` : '' }} guests
              </span>
              <!-- Inline max-edit -->
              <template v-if="!editingMax">
                <button
                  class="font-mono text-[0.65rem] text-gray-400 hover:text-[#34418F] dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                  title="Edit max attendees"
                  @click="startEditMax"
                >✎</button>
              </template>
              <template v-else>
                <input
                  ref="maxEditInput"
                  v-model.number="maxEditValue"
                  type="number"
                  min="1"
                  placeholder="∞"
                  class="w-20 rounded-md border border-[#34418F] px-2 py-0.5 font-mono text-xs outline-none dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200"
                  @keydown.enter="saveMax"
                  @keydown.escape="editingMax = false"
                />
                <button class="font-mono text-[0.65rem] text-emerald-500 hover:text-emerald-600 transition-colors" @click="saveMax">Save</button>
                <button class="font-mono text-[0.65rem] text-gray-400 hover:text-gray-600 transition-colors" @click="editingMax = false">×</button>
              </template>
            </div>

            <!-- Add Guest button -->
            <button
              v-if="event.selectionLocked"
              :disabled="isAtCapacity"
              :class="[
                'rounded-lg border px-3 py-1 text-sm font-semibold transition-colors',
                isAtCapacity
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed dark:border-slate-700 dark:text-slate-600'
                  : 'border-[#34418F] text-[#34418F] hover:bg-[#34418F] hover:text-white dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700',
              ]"
              @click="showAddGuest = true"
            >
              + Add Guest
            </button>
          </div>
        </div>

        <!-- Header right buttons -->
        <div class="flex flex-wrap gap-2">
          <a
            :href="`/tix/${slug}`"
            target="_blank"
            class="rounded-lg border border-gray-200 px-4 py-2 text-xs font-mediumr text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-400"
            data-cursor="nav"
          >
            Attendee view ↗
          </a>
        </div>
      </div>

      <!-- Cluster fill bars (lead only, only if clusters exist) -->
      <div v-if="event.isLead && clusters.length" class="mb-6">
        <button
          class="mb-2 flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-[#34418F] dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          @click="showClusters = !showClusters"
        >
          <span>{{ showClusters ? '▼' : '▶' }}</span> Clusters
        </button>
        <div v-if="showClusters" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            v-for="cl in clusters"
            :key="cl.value"
            class="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-600 dark:bg-slate-800/60"
          >
            <div class="flex flex-1 items-start justify-between gap-3 px-4 py-2.5">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold leading-tight text-gray-800 dark:text-slate-200">{{ cl.value }}</p>
                <p class="flex items-center gap-1 font-mono text-xs text-gray-500 dark:text-slate-400">
                  <span>{{ cl.currentCount }}</span>
                  <span>/</span>
                  <!-- max count: inline edit -->
                  <template v-if="editingMaxCluster === cl.value">
                    <input
                      v-model.number="clusterMaxEditValue"
                      type="number"
                      min="1"
                      placeholder="∞"
                      class="w-14 rounded border border-[#34418F] px-1 py-0 font-mono text-xs outline-none dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200"
                      @keydown.enter="saveClusterMax(cl.value)"
                      @keydown.escape="editingMaxCluster = ''"
                      @blur="saveClusterMax(cl.value)"
                    />
                  </template>
                  <template v-else>
                    <span>{{ cl.maxCount ?? '∞' }}</span>
                    <button
                      class="font-mono text-[0.6rem] text-gray-400 hover:text-[#34418F] dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                      title="Edit max"
                      @click="startEditClusterMax(cl.value, cl.maxCount)"
                    >✎</button>
                  </template>
                  <span v-if="(cl.remainingSlots ?? 0) > 0" class="text-amber-500">({{ cl.remainingSlots }} open)</span>
                </p>
              </div>
              <button
                v-if="cl.id && (cl.remainingSlots ?? 0) > 0"
                :disabled="rafflingCluster === cl.value"
                class="flex-shrink-0"
                :class="[
                  'rounded-lg px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-wide transition-colors',
                  rafflingCluster === cl.value
                    ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-500'
                    : 'bg-[#34418F]/10 text-[#34418F] hover:bg-[#34418F] hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600',
                ]"
                @click="reRaffle(cl.value)"
              >
                {{ rafflingCluster === cl.value ? '…' : 'Re-raffle' }}
              </button>
            </div>
            <!-- Fill bar (only when maxCount is set) -->
            <div v-if="cl.maxCount" class="h-1 w-full bg-gray-100 dark:bg-slate-700">
              <div
                class="h-1 rounded-full bg-[#34418F] dark:bg-slate-400 transition-all duration-500"
                :style="`width: ${Math.min(100, ((cl.currentCount ?? 0) / cl.maxCount) * 100)}%`"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="mb-6 flex flex-wrap gap-2">
        <button
          v-for="(t, i) in TABS"
          :key="t.label"
          :class="[
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === i
              ? 'bg-[#34418F] text-white dark:bg-slate-700 dark:text-slate-100'
              : 'bg-transparent text-gray-400 hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200',
          ]"
          data-cursor="nav"
          @click="switchTab(i)"
        >
          {{ t.label }}
          <span
            v-if="t.filter !== null && attendees.length"
            class="ml-1 opacity-60"
          >({{ countForTab(t.filter) }})</span>
        </button>
      </div>

      <!-- Scanner tab -->
      <div v-if="activeTab === 5">
        <div class="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-600">
          <div class="flex flex-col items-center px-4 py-6">
            <p class="mb-4 text-center text-xs font-medium text-gray-500 dark:text-slate-400">
              Point the camera at an attendee's QR code to check them in.
            </p>
            <div
              v-if="scannerError"
              class="mb-4 w-full max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-mono text-xs text-red-500 dark:border-red-900/40 dark:bg-red-900/10"
            >
              {{ scannerError }}
            </div>
            <div class="relative w-full max-w-sm overflow-hidden rounded-xl bg-black" style="aspect-ratio: 4/3;">
              <video ref="videoRef" class="h-full w-full object-cover" muted playsinline />

              <!-- Tap-to-enable: getUserMedia MUST run inside a user gesture (click).
                   Auto-starting from a tab watcher loses Chrome's user-activation and
                   yields NotAllowedError with no permission prompt. -->
              <div
                v-if="needsCameraPrompt"
                class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-6"
              >
                <p class="text-center text-xs font-medium text-white/80">
                  Camera access is required to scan QR codes.
                </p>
                <button
                  type="button"
                  class="rounded-xl bg-[#DEAC4B] px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 dark:bg-eypi-gold-dark"
                  @click="onEnableCameraClick"
                >
                  {{ cameraStarting ? 'Starting…' : scanStatus === 'error' ? 'Retry Camera' : 'Enable Camera' }}
                </button>
              </div>

              <!-- Purely visual aiming guide — CSS only, never touches the
                   pixels handed to the detection engines. -->
              <div class="pointer-events-none absolute inset-0">
                <div
                  class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-white/90"
                  style="width: 72%; aspect-ratio: 1; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);"
                />
              </div>

              <!-- Phase HUD badge -->
              <div
                :class="hudClass"
                class="pointer-events-none absolute inset-x-3 top-3 rounded-lg px-3 py-2 text-data text-xs font-semibold text-white"
              >
                {{ hudLabel }}
              </div>

              <!-- Detail message banner -->
              <div
                v-if="scanMessage"
                :class="hudBannerClass"
                class="pointer-events-none absolute inset-x-0 bottom-0 px-4 py-3 font-mono text-sm font-bold uppercase tracking-wide text-white"
              >
                {{ scanMessage }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Attendee table -->
      <div v-else>
        <!-- Search + Export -->
        <div class="mb-3 flex gap-2">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name, email, or group…"
            class="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-mono text-xs outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:border-slate-400"
          />
          <button
            :disabled="!attendees.length || exportingXlsx"
            class="flex-shrink-0 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] disabled:opacity-40 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-400"
            @click="exportToXlsx"
          >
            {{ exportingXlsx ? '…' : 'Export .xlsx' }}
          </button>
        </div>

        <div v-if="loadingAttendees" class="space-y-2">
          <div v-for="i in 5" :key="i" class="h-14 animate-pulse rounded-xl bg-gray-200 dark:bg-slate-800/60" />
        </div>

        <div v-else>
          <div class="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-600">
            <div class="min-w-[640px]">
            <!-- Sortable header -->
            <div class="grid grid-cols-12 border-b border-gray-100 bg-gray-50/60 text-data text-xs font-semibold text-[#34418F] dark:border-slate-700 dark:bg-mica-navy-header dark:text-slate-300">
              <button class="col-span-4 flex items-center gap-1 px-4 py-3 text-left transition-colors hover:text-[#2a3578] dark:hover:text-slate-100" @click="toggleSort('name')">
                Attendee <span class="opacity-40">{{ sortField === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
              </button>
              <button class="col-span-3 hidden sm:flex items-center gap-1 px-4 py-3 text-left transition-colors hover:text-[#2a3578] dark:hover:text-slate-100" @click="toggleSort('email')">
                Email <span class="opacity-40">{{ sortField === 'email' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
              </button>
              <button class="col-span-3 hidden sm:flex items-center gap-1 px-4 py-3 text-left transition-colors hover:text-[#2a3578] dark:hover:text-slate-100" @click="toggleSort('status')">
                Status · Time <span class="opacity-40">{{ sortField === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : sortField === 'time' ? (sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
              </button>
              <div class="col-span-5 sm:col-span-2 px-4 py-3 text-right">Actions</div>
            </div>

            <!-- Empty state -->
            <div
              v-if="!filteredAttendees.length"
              class="px-4 py-12 text-center text-sm font-medium text-gray-400 dark:text-slate-500"
            >
              {{ searchQuery.trim() ? `No results for "${searchQuery.trim()}"` : `No ${TABS[activeTab].label.toLowerCase()} attendees` }}
            </div>

            <!-- Rows -->
            <div
              v-for="a in paginatedAttendees"
              :key="a.id as string"
              class="grid grid-cols-12 items-center border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50/60 dark:border-slate-700/60 dark:hover:bg-mica-navy-row-hover last:border-0"
            >
              <div class="col-span-7 sm:col-span-4">
                <p class="font-mono text-sm font-bold text-gray-900 dark:text-slate-100">{{ a.first_name }} {{ a.last_name }}</p>
                <!-- Inline cluster edit -->
                <template v-if="editingClusterAttendee === (a.id as string)">
                  <input
                    v-model="attendeeClusterEditValue"
                    type="text"
                    list="cluster-suggestions"
                    placeholder="Cluster…"
                    class="mt-0.5 w-full rounded border border-[#34418F] px-1.5 py-0.5 font-mono text-[0.6rem] outline-none dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200"
                    @keydown.enter="saveAttendeeCluster(a.id as string)"
                    @keydown.escape="editingClusterAttendee = ''"
                    @blur="saveAttendeeCluster(a.id as string)"
                  />
                </template>
                <template v-else>
                  <p
                    class="mt-0.5 cursor-pointer font-mono text-[0.6rem] text-gray-400 hover:text-[#34418F] dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                    :title="a.cluster_value ? 'Click to edit cluster' : 'Click to assign cluster'"
                    @click="startEditAttendeeCluster(a.id as string, a.cluster_value as string)"
                  >{{ a.cluster_value || '+ cluster' }}</p>
                </template>
              </div>
              <div class="col-span-3 hidden sm:block">
                <p class="truncate font-mono text-xs text-gray-500 dark:text-slate-400">{{ a.email }}</p>
              </div>
              <div class="col-span-3 hidden sm:block">
                <span
                  :class="statusClass(a.status as string)"
                  class="rounded px-2 py-0.5 font-mono text-[0.65rem] font-bold uppercase tracking-wide"
                >
                  {{ statusLabel(a.status as string) }}
                </span>
                <p v-if="a.actioned_at" class="mt-0.5 font-mono text-[0.6rem] text-gray-400 dark:text-slate-500">
                  {{ formatDateTime(a.actioned_at as string) }}
                </p>
              </div>
              <div class="col-span-5 sm:col-span-2 flex justify-end gap-1">
                <button
                  v-if="a.status !== 'checked_in' && a.status !== 'removed'"
                  :disabled="!!actionPending"
                  class="rounded-lg px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-white transition-colors bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40"
                  @click="checkin(a.id as string)"
                  title="Check in"
                >In</button>
                <button
                  v-if="a.status === 'checked_in'"
                  :disabled="!!actionPending"
                  class="rounded-lg px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-white transition-colors bg-gray-500 hover:bg-gray-600 disabled:opacity-40"
                  @click="checkout(a.id as string)"
                  title="Check out"
                >Out</button>
                <button
                  v-if="a.status !== 'removed'"
                  :disabled="!!actionPending"
                  class="rounded-lg px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-white transition-colors bg-red-500 hover:bg-red-600 disabled:opacity-40"
                  @click="remove(a.id as string)"
                  title="Remove"
                >✕</button>
              </div>
            </div>
            </div>
          </div>

          <!-- Pagination -->
          <div
            v-if="totalPages > 1 || filteredAttendees.length > 0"
            class="mt-4 flex items-center justify-between font-mono text-xs text-gray-400 dark:text-slate-500"
          >
            <span>{{ filteredAttendees.length }} result{{ filteredAttendees.length === 1 ? '' : 's' }} · page {{ currentPage }} of {{ totalPages }}</span>
            <div class="flex gap-1">
              <button
                :disabled="currentPage === 1"
                class="rounded-lg border border-gray-200 px-3 py-1.5 transition-colors hover:border-[#34418F] hover:text-[#34418F] disabled:opacity-30 dark:border-slate-600 dark:hover:border-slate-400"
                @click="currentPage--"
              >← Prev</button>
              <button
                :disabled="currentPage === totalPages"
                class="rounded-lg border border-gray-200 px-3 py-1.5 transition-colors hover:border-[#34418F] hover:text-[#34418F] disabled:opacity-30 dark:border-slate-600 dark:hover:border-slate-400"
                @click="currentPage++"
              >Next →</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Danger zone -->
      <div v-if="event.isLead" class="mt-12 border-t border-dashed border-red-200 pt-8 dark:border-red-900/30">
        <p class="text-card-title mb-1 text-red-500">Danger Zone</p>
        <p class="mb-4 font-mono text-xs text-gray-400 dark:text-slate-500">
          Permanently deletes this event and all attendee data. This cannot be undone.
        </p>
        <button
          :disabled="deletingEvent"
          class="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 transition-colors hover:bg-red-500 hover:text-white disabled:opacity-40 dark:border-red-800/60 dark:hover:bg-red-700"
          @click="confirmDeleteEvent"
        >
          {{ deletingEvent ? 'Deleting…' : 'Delete Event' }}
        </button>
      </div>
    </template>

    </div><!-- /content card -->

    <!-- ─── ADD GUEST SLIDE PANEL ────────────────────────────────────── -->
    <Transition name="panel">
      <div v-if="showAddGuest" class="fixed inset-x-0 bottom-0 top-20 z-50 flex justify-end">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="showAddGuest = false" />
        <!-- Panel -->
        <div class="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
          <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-slate-700">
            <h2 class="text-sm font-semibold text-[#34418F] dark:text-slate-300">Add Guest</h2>
            <button class="font-mono text-lg text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors" @click="showAddGuest = false">×</button>
          </div>

          <!-- Tab toggle -->
          <div class="flex border-b border-gray-100 dark:border-slate-700">
            <button
              v-if="hasCsvRows"
              :class="[
                'flex-1 py-3 text-sm font-semibold transition-colors',
                guestMode === 'search' ? 'border-b-2 border-[#34418F] text-[#34418F] dark:border-slate-400 dark:text-slate-200' : 'text-gray-400 hover:text-gray-600 dark:text-slate-500',
              ]"
              @click="guestMode = 'search'"
            >From CSV</button>
            <button
              :class="[
                'flex-1 py-3 text-sm font-semibold transition-colors',
                guestMode === 'freeform' ? 'border-b-2 border-[#34418F] text-[#34418F] dark:border-slate-400 dark:text-slate-200' : 'text-gray-400 hover:text-gray-600 dark:text-slate-500',
              ]"
              @click="guestMode = 'freeform'"
            >Free-form</button>
          </div>

          <div class="flex-1 p-6">
            <!-- From CSV search -->
            <div v-if="guestMode === 'search' && hasCsvRows">
              <input
                v-model="guestSearch"
                type="text"
                placeholder="Search by name or email…"
                class="mb-4 w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400"
              />
              <div v-if="guestSearchResults.length" class="space-y-1">
                <div
                  v-for="row in guestSearchResults"
                  :key="row.id"
                  class="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-slate-600"
                >
                  <div>
                    <p class="font-mono text-sm font-bold text-gray-800 dark:text-slate-200">{{ guestRowName(row) }}</p>
                    <p class="font-mono text-xs text-gray-400 dark:text-slate-500">
                      {{ guestRowEmail(row) }}
                      <span v-if="row.isSelected" class="ml-2 text-emerald-500">Already added</span>
                    </p>
                  </div>
                  <button
                    v-if="!row.isSelected"
                    :disabled="addingGuest"
                    class="rounded-lg bg-[#34418F] px-3 py-1 font-mono text-xs text-white transition-colors hover:brightness-110 disabled:opacity-40 dark:bg-slate-600"
                    @click="addGuestFromCsv(row.id)"
                  >Add</button>
                </div>
              </div>
              <p v-else-if="guestSearch.trim()" class="font-mono text-xs text-gray-400 dark:text-slate-500">No matches found.</p>
            </div>

            <!-- Free-form -->
            <div v-if="guestMode === 'freeform'" class="flex flex-col gap-4">
              <div>
                <label class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">First Name *</label>
                <input v-model="guestForm.firstName" type="text" class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" />
              </div>
              <div>
                <label class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">Last Name</label>
                <input v-model="guestForm.lastName" type="text" class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" />
              </div>
              <div>
                <label class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">Email *</label>
                <input v-model="guestForm.email" type="email" class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" />
              </div>
              <div>
                <label class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">Cluster <span class="font-normal text-gray-400">(optional)</span></label>
                <input
                  v-model="guestForm.clusterValue"
                  type="text"
                  list="cluster-suggestions"
                  placeholder="Type or pick a cluster…"
                  class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                />
                <datalist id="cluster-suggestions">
                  <option v-for="cl in clusters" :key="cl.value" :value="cl.value" />
                </datalist>
              </div>
              <button
                :disabled="addingGuest || !guestForm.firstName.trim() || !guestForm.email.trim()"
                :class="[
                  'w-full rounded-xl bg-[#DEAC4B] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 dark:bg-eypi-gold-dark',
                  (addingGuest || !guestForm.firstName.trim() || !guestForm.email.trim()) ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110',
                ]"
                @click="addGuestFreeform"
              >
                {{ addingGuest ? 'Adding…' : 'Add Guest' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import { TIX_API_URL } from '@/config/tix-api'
import { TIX_QR_RENDER_OPTIONS } from '@/utils/tix-qr'
import type { ClusterConfig } from '@/types/selection'
import {
  CAMERA_CONSTRAINTS,
  SCAN_COOLDOWN_MS,
  SCAN_FPS,
  canUseNativeBarcodeDetector,
  formatScannerError,
  isRetriableCameraError,
  isValidQrToken,
  playScanFeedback,
  scannerPermissionHint,
  type ScanStatus,
} from '@/utils/tix-scanner'

const toast = useToast()
const { authHeaders } = useAuth()
const route = useRoute()
const router = useRouter()

const slug = route.params.id as string

interface EventInfo {
  name: string; eventDate: string; eventTime: string; location: string; isLead: boolean
  maxAttendees: number | null; selectionLocked: boolean; attendeeCount: number
}
interface Attendee {
  id: unknown; first_name: unknown; last_name: unknown; email: unknown
  status: unknown; actioned_at: unknown; cluster_value: unknown
}

const event             = ref<EventInfo | null>(null)
const loadingEvent      = ref(true)
const attendees         = ref<Attendee[]>([])
const loadingAttendees  = ref(true)
const actionPending     = ref('')
const deletingEvent     = ref(false)
const exportingXlsx     = ref(false)
const clusters          = ref<(ClusterConfig & { currentCount: number; remainingSlots: number | null })[]>([])
const showClusters      = ref(true)
const rafflingCluster   = ref('')

// ── cluster max-count editing ─────────────────────────────────────────────────
const editingMaxCluster   = ref('')
const clusterMaxEditValue = ref<number | null>(null)

function startEditClusterMax(value: string, current: number | null) {
  editingMaxCluster.value   = value
  clusterMaxEditValue.value = current
}
async function saveClusterMax(value: string) {
  if (editingMaxCluster.value !== value) return
  editingMaxCluster.value = ''
  try {
    const res = await fetch(
      `${TIX_API_URL}/api/events/${slug}/clusters/${encodeURIComponent(value)}/max-count`,
      { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ maxCount: clusterMaxEditValue.value ?? null }) },
    )
    if (!res.ok) throw new Error((await res.json() as { message?: string }).message ?? 'Failed.')
    await fetchClusters()
    toast.success('Max updated.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Update failed.')
  }
}

// ── attendee cluster editing ──────────────────────────────────────────────────
const editingClusterAttendee  = ref('')
const attendeeClusterEditValue = ref('')

function startEditAttendeeCluster(id: string, current: string) {
  editingClusterAttendee.value  = id
  attendeeClusterEditValue.value = current ?? ''
}
async function saveAttendeeCluster(id: string) {
  if (editingClusterAttendee.value !== id) return
  editingClusterAttendee.value = ''
  const newVal = attendeeClusterEditValue.value.trim() || null
  try {
    const res = await fetch(
      `${TIX_API_URL}/api/events/${slug}/attendees/${id}`,
      { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ clusterValue: newVal }) },
    )
    if (!res.ok) throw new Error((await res.json() as { message?: string }).message ?? 'Failed.')
    const a = attendees.value.find(x => x.id === id)
    if (a) a.cluster_value = newVal
    await fetchClusters()
    toast.success('Cluster updated.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Update failed.')
  }
}

// ── search / sort / pagination ────────────────────────────────────────────────
const searchQuery = ref('')
const sortField   = ref<'name' | 'email' | 'status' | 'time'>('name')
const sortDir     = ref<'asc' | 'desc'>('asc')
const currentPage = ref(1)
const PAGE_SIZE   = 10

const TABS = [
  { label: 'All',         filter: null },
  { label: 'Pending',     filter: 'pending' },
  { label: 'Checked In',  filter: 'checked_in' },
  { label: 'Checked Out', filter: 'checked_out' },
  { label: 'Removed',     filter: 'removed' },
  { label: 'Scanner',     filter: null },
] as const

const activeTab = ref(0)

// ── capacity ──────────────────────────────────────────────────────────────────
const activeAttendeeCount = computed(() =>
  attendees.value.filter(a => a.status !== 'removed').length
)

const isAtCapacity = computed(() =>
  event.value?.maxAttendees !== null && event.value?.maxAttendees !== undefined &&
  activeAttendeeCount.value >= event.value.maxAttendees
)

// max edit
const editingMax   = ref(false)
const maxEditValue = ref<number | null>(null)
const maxEditInput = ref<HTMLInputElement | null>(null)

function startEditMax() {
  maxEditValue.value = event.value?.maxAttendees ?? null
  editingMax.value = true
  nextTick(() => maxEditInput.value?.focus())
}
async function saveMax() {
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ maxAttendees: maxEditValue.value ?? null }),
    })
    if (!res.ok) throw new Error((await res.json() as { message?: string }).message ?? 'Failed.')
    if (event.value) event.value.maxAttendees = maxEditValue.value
    editingMax.value = false
    toast.success('Max attendees updated.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Update failed.')
  }
}

// ── add guest panel ───────────────────────────────────────────────────────────
const showAddGuest = ref(false)
const guestMode    = ref<'search' | 'freeform'>('search')
const guestSearch  = ref('')
const addingGuest  = ref(false)
const hasCsvRows   = ref(false)
const guestForm    = ref({ firstName: '', lastName: '', email: '', clusterValue: '' })

interface CsvSearchRow { id: string; rowIndex: number; rawData: Record<string, string>; isSelected: boolean }
const guestSearchResults = ref<CsvSearchRow[]>([])

let guestSearchTimer: ReturnType<typeof setTimeout> | null = null
watch(guestSearch, (q) => {
  if (guestSearchTimer) clearTimeout(guestSearchTimer)
  if (!q.trim()) { guestSearchResults.value = []; return }
  guestSearchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`${TIX_API_URL}/api/events/${slug}/csv-rows/search?q=${encodeURIComponent(q.trim())}`, { headers: authHeaders() })
      const data = await res.json() as { rows?: CsvSearchRow[] }
      guestSearchResults.value = data.rows ?? []
    } catch { /* ignore */ }
  }, 300)
})

// Derive name/email from CSV row rawData using column mapping (best-effort)
let csvColMapping: { firstNameCol?: string; lastNameCol?: string; fullNameCol?: string; emailCol?: string } = {}
function guestRowName(row: CsvSearchRow): string {
  if (csvColMapping.firstNameCol && csvColMapping.lastNameCol) {
    return `${row.rawData[csvColMapping.firstNameCol] ?? ''} ${row.rawData[csvColMapping.lastNameCol] ?? ''}`.trim()
  }
  if (csvColMapping.fullNameCol) return row.rawData[csvColMapping.fullNameCol] ?? ''
  return Object.values(row.rawData).slice(0, 2).join(' ')
}
function guestRowEmail(row: CsvSearchRow): string {
  return csvColMapping.emailCol ? row.rawData[csvColMapping.emailCol] ?? '' : ''
}

async function addGuestFromCsv(csvRowId: string) {
  addingGuest.value = true
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}/add-guest`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ csvRowId }),
    })
    const data = await res.json() as { status: string; message?: string; attendee?: { firstName: string; lastName: string; email: string; qrToken: string } }
    if (!res.ok) throw new Error(data.message ?? 'Failed to add guest.')
    await downloadGuestQr(data.attendee!)
    toast.success(`${data.attendee!.firstName} ${data.attendee!.lastName} added.`)
    // Mark as selected in results
    const row = guestSearchResults.value.find(r => r.id === csvRowId)
    if (row) row.isSelected = true
    await fetchAttendees()
    await fetchClusters()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed.')
  } finally {
    addingGuest.value = false
  }
}

async function addGuestFreeform() {
  if (!guestForm.value.firstName.trim() || !guestForm.value.email.trim()) return
  addingGuest.value = true
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}/add-guest`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        firstName:    guestForm.value.firstName.trim(),
        lastName:     guestForm.value.lastName.trim(),
        email:        guestForm.value.email.trim(),
        clusterValue: guestForm.value.clusterValue || null,
      }),
    })
    const data = await res.json() as { status: string; message?: string; attendee?: { firstName: string; lastName: string; email: string; qrToken: string } }
    if (!res.ok) throw new Error(data.message ?? 'Failed to add guest.')
    await downloadGuestQr(data.attendee!)
    toast.success(`${data.attendee!.firstName} ${data.attendee!.lastName} added.`)
    guestForm.value = { firstName: '', lastName: '', email: '', clusterValue: '' }
    showAddGuest.value = false
    await fetchAttendees()
    await fetchClusters()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed.')
  } finally {
    addingGuest.value = false
  }
}

async function downloadGuestQr(a: { firstName: string; lastName: string; qrToken: string }) {
  const { default: QRCodeStyling } = await import('qr-code-styling')
  const qr = new QRCodeStyling({
    width: 400, height: 400, type: 'canvas',
    data: a.qrToken,
    ...TIX_QR_RENDER_OPTIONS,
  })
  const blob = await qr.getRawData('png')
  if (blob) {
    const name = `${a.firstName}_${a.lastName}`.replace(/[^a-zA-Z0-9_]/g, '_')
    const url = URL.createObjectURL(blob as Blob)
    const link = document.createElement('a')
    link.href = url; link.download = `${name}-qr.png`; link.click()
    URL.revokeObjectURL(url)
  }
}

// ── re-raffle ─────────────────────────────────────────────────────────────────
async function reRaffle(clusterValue: string) {
  if (!confirm(`Re-raffle "${clusterValue}"? This will randomly add attendees from unselected eligible respondents.`)) return
  rafflingCluster.value = clusterValue
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}/clusters/${encodeURIComponent(clusterValue)}/raffle`, {
      method: 'POST',
      headers: authHeaders(),
    })
    const data = await res.json() as { status: string; message?: string; attendees?: { firstName: string; lastName: string; qrToken: string }[] }
    if (!res.ok) throw new Error(data.message ?? 'Re-raffle failed.')

    // Auto-download QR codes for new attendees
    for (const a of (data.attendees ?? [])) {
      await downloadGuestQr(a)
    }
    toast.success(`${data.attendees?.length ?? 0} new attendee(s) added to ${clusterValue}.`)
    await fetchAttendees()
    await fetchClusters()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Re-raffle failed.')
  } finally {
    rafflingCluster.value = ''
  }
}

// ── scanner ───────────────────────────────────────────────────────────────────
const videoRef = ref<HTMLVideoElement | null>(null)
const scannerError = ref('')
const scanStatus = ref<ScanStatus>('idle')
const scanMessage = ref('')

type QrScannerInstance = InstanceType<typeof import('qr-scanner').default>
type QrScannerModule = typeof import('qr-scanner').default

/** Minimal shape of the native BarcodeDetector API (not yet in all TS lib targets). */
type NativeBarcodeDetector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}

let qrScanner: QrScannerInstance | null = null
let activeStream: MediaStream | null = null
let resetTimer: ReturnType<typeof setTimeout> | null = null
let scanCooldown = false
const cameraStarting = ref(false)
let startToken = 0

// Native GPU-accelerated path (Chrome/Android/Windows). Runs on raw
// requestAnimationFrame ticks against the full, uncropped video element —
// modern hardware decodes an entire frame in sub-millisecond time, so there
// is nothing to gain (and latency to lose) by cropping or throttling it.
let nativeDetector: NativeBarcodeDetector | null = null
let nativeRafId: number | null = null
let detecting = false

const needsCameraPrompt = computed(() =>
  activeTab.value === 5
  && (scanStatus.value === 'idle' || scanStatus.value === 'error')
  && !cameraStarting.value,
)

// Fallback engine (iOS/Safari and any browser without BarcodeDetector).
// No calculateScanRegion — the worker processes the full native frame size
// so nothing is destructively clipped before jsQR ever sees it.
const QR_SCANNER_OPTIONS = {
  highlightScanRegion: false,
  highlightCodeOutline: false,
  maxScansPerSecond: SCAN_FPS,
  returnDetailedScanResult: true as const,
}

const hudLabel = computed(() => {
  const labels: Record<ScanStatus, string> = {
    idle: 'Idle',
    ready: 'Ready',
    decoding: 'Decoding',
    submitting: 'Checking In',
    success: 'Success',
    error: 'Error',
  }
  return labels[scanStatus.value]
})

const hudClass = computed(() => {
  const classes: Record<ScanStatus, string> = {
    idle: 'bg-gray-600',
    ready: 'bg-emerald-600',
    decoding: 'bg-amber-500',
    submitting: 'bg-blue-600',
    success: 'bg-emerald-600',
    error: 'bg-red-600',
  }
  return classes[scanStatus.value]
})

const hudBannerClass = computed(() => {
  if (scanStatus.value === 'success') return 'bg-emerald-600'
  if (scanStatus.value === 'error') return 'bg-red-600'
  if (scanStatus.value === 'submitting') return 'bg-blue-600'
  return 'bg-gray-700'
})

function scheduleReset(ms: number) {
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    scanCooldown = false
    scanStatus.value = 'decoding'
    scanMessage.value = ''
    resetTimer = null
  }, ms)
}

function onDecoded(raw: string | null) {
  if (!raw || scanCooldown) return

  if (!isValidQrToken(raw)) {
    scanCooldown = true
    scanStatus.value = 'error'
    scanMessage.value = 'Invalid token format'
    scheduleReset(SCAN_COOLDOWN_MS)
    return
  }

  scanCooldown = true
  playScanFeedback()
  scanStatus.value = 'submitting'
  scanMessage.value = 'Submitting check-in…'
  submitScan(raw.trim())
}

function submitScan(qrToken: string) {
  fetch(`${TIX_API_URL}/api/events/${slug}/checkin`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ qrToken }),
  })
    .then(async (res) => {
      const data = await res.json() as { message: string }
      if (res.ok) {
        scanStatus.value = 'success'
        scanMessage.value = data.message
        fetchAttendees()
      } else {
        scanStatus.value = 'error'
        scanMessage.value = data.message
      }
    })
    .catch(() => {
      scanStatus.value = 'error'
      scanMessage.value = 'Network error'
    })
    .finally(() => scheduleReset(SCAN_COOLDOWN_MS))
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach(t => t.stop())
}

function releaseActiveStream() {
  stopStream(activeStream)
  activeStream = null
  if (videoRef.value?.srcObject instanceof MediaStream) {
    stopStream(videoRef.value.srcObject)
    videoRef.value.srcObject = null
  }
}

/**
 * Drives the native BarcodeDetector against raw rAF ticks. detect() runs
 * fully async and the next frame is always scheduled immediately — the
 * `detecting` mutex only prevents two overlapping detect() calls from
 * queueing up, it never delays or skips the rAF loop itself, so the camera
 * preview and detection cadence stay perfectly real-time.
 */
function startNativeDetectionLoop(detector: NativeBarcodeDetector, video: HTMLVideoElement) {
  const tick = () => {
    if (!detecting && !scanCooldown && video.readyState >= video.HAVE_CURRENT_DATA) {
      detecting = true
      detector.detect(video)
        .then((codes) => { onDecoded(codes[0]?.rawValue ?? null) })
        .catch(() => { /* transient frame miss (e.g. mid-resize) — next tick retries */ })
        .finally(() => { detecting = false })
    }
    nativeRafId = requestAnimationFrame(tick)
  }
  nativeRafId = requestAnimationFrame(tick)
}

function stopNativeDetectionLoop() {
  if (nativeRafId !== null) {
    cancelAnimationFrame(nativeRafId)
    nativeRafId = null
  }
  nativeDetector = null
  detecting = false
}

function destroyQrScanner() {
  stopNativeDetectionLoop()
  if (qrScanner) {
    qrScanner.stop()
    qrScanner.destroy()
    qrScanner = null
  }
  releaseActiveStream()
}

/** Tries constraint sets from `fromIndex` onward (async fallbacks after the first). */
async function acquireCameraStreamFrom(fromIndex: number): Promise<MediaStream> {
  let lastError: unknown = null
  for (let i = fromIndex; i < CAMERA_CONSTRAINTS.length; i++) {
    try {
      return await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS[i])
    } catch (err) {
      lastError = err
      if (!isRetriableCameraError(err)) throw err
    }
  }
  throw lastError ?? new DOMException('No camera could be acquired', 'NotFoundError')
}

/**
 * Begin getUserMedia synchronously inside a user-gesture handler (button click).
 * Must NOT await anything before the first getUserMedia call — Chrome revokes
 * user activation across awaits and will reject with NotAllowedError silently.
 */
function beginCameraStreamRequest(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new DOMException('Camera API unavailable', 'NotSupportedError'))
  }
  return navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS[0]).catch((err) => {
    if (!isRetriableCameraError(err)) throw err
    return acquireCameraStreamFrom(1)
  })
}

async function loadQrScannerModule(): Promise<QrScannerModule> {
  const [{ default: QrScanner }, { default: workerUrl }] = await Promise.all([
    import('qr-scanner'),
    import('qr-scanner/qr-scanner-worker.min.js?url'),
  ])
  // Same-origin worker URL satisfies CSP worker-src 'self' (blob: workers are blocked).
  QrScanner.WORKER_PATH = workerUrl
  return QrScanner
}

async function startQrScannerEngine(
  video: HTMLVideoElement,
  stream: MediaStream,
  token: number,
): Promise<boolean> {
  const QrScanner = await loadQrScannerModule()
  if (token !== startToken) return false

  destroyQrScanner()
  qrScanner = new QrScanner(video, (result) => onDecoded(result.data), QR_SCANNER_OPTIONS)
  activeStream = stream
  video.srcObject = stream
  await qrScanner.start()
  return token === startToken
}

async function startNativeScannerEngine(
  video: HTMLVideoElement,
  stream: MediaStream,
  token: number,
): Promise<boolean> {
  destroyQrScanner()
  activeStream = stream
  video.srcObject = stream
  await video.play()
  if (token !== startToken) return false

  // @ts-expect-error BarcodeDetector is not yet in all TS lib targets
  nativeDetector = new window.BarcodeDetector({ formats: ['qr_code'] }) as NativeBarcodeDetector
  startNativeDetectionLoop(nativeDetector, video)
  return token === startToken
}

function reportScannerError(err: unknown) {
  const base = formatScannerError(err)
  const hint = scannerPermissionHint(err)
  const message = hint ? `${base} — ${hint}` : base
  scannerError.value = message
  scanStatus.value = 'error'
  scanMessage.value = message
}

function onEnableCameraClick() {
  void startScannerFromUserGesture()
}

async function startScannerFromUserGesture() {
  const token = ++startToken
  scannerError.value = ''
  scanMessage.value = ''
  scanStatus.value = 'idle'
  cameraStarting.value = true

  if (!window.isSecureContext) {
    cameraStarting.value = false
    reportScannerError(new DOMException('Camera requires HTTPS', 'SecurityError'))
    return
  }

  // Fire getUserMedia NOW — still inside the click's user-activation window.
  const streamPromise = beginCameraStreamRequest()

  await nextTick()
  if (token !== startToken) return

  const video = videoRef.value
  if (!video?.isConnected) {
    cameraStarting.value = false
    reportScannerError(new DOMException('Video element not mounted', 'NotFoundError'))
    return
  }

  let stream: MediaStream
  try {
    stream = await streamPromise
  } catch (err) {
    cameraStarting.value = false
    if (token === startToken) reportScannerError(err)
    return
  }
  if (token !== startToken) { stopStream(stream); cameraStarting.value = false; return }

  try {
    if (await canUseNativeBarcodeDetector()) {
      try {
        const started = await startNativeScannerEngine(video, stream, token)
        if (!started) { destroyQrScanner(); cameraStarting.value = false; return }
      } catch {
        const started = await startQrScannerEngine(video, stream, token)
        if (!started) { destroyQrScanner(); cameraStarting.value = false; return }
      }
    } else {
      const started = await startQrScannerEngine(video, stream, token)
      if (!started) { destroyQrScanner(); cameraStarting.value = false; return }
    }

    if (token !== startToken) { destroyQrScanner(); cameraStarting.value = false; return }
    cameraStarting.value = false
    scanStatus.value = 'decoding'
  } catch (err) {
    stopStream(stream)
    destroyQrScanner()
    cameraStarting.value = false
    if (token === startToken) reportScannerError(err)
  }
}

function stopScanner() {
  startToken++
  if (resetTimer) { clearTimeout(resetTimer); resetTimer = null }
  destroyQrScanner()
  scanCooldown = false
  cameraStarting.value = false
  scanStatus.value = 'idle'
  scanMessage.value = ''
  scannerError.value = ''
}

watch(activeTab, (_tab, prev) => {
  if (prev === 5) stopScanner()
})

function switchTab(i: number) { activeTab.value = i; currentPage.value = 1; searchQuery.value = '' }

// ── formatting ────────────────────────────────────────────────────────────────
function formatDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
function formatTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
function formatDateTime(dt: string) {
  if (!dt) return ''
  return new Date(dt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function statusLabel(s: string) {
  if (!s) return 'Pending'
  return { checked_in: 'Checked In', checked_out: 'Checked Out', removed: 'Removed' }[s] ?? 'Pending'
}
function statusClass(s: string) {
  return {
    checked_in:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    checked_out: 'bg-gray-100 text-gray-600 dark:bg-slate-700/50 dark:text-slate-400',
    removed:     'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  }[s] ?? 'bg-gray-100 text-gray-400 dark:bg-slate-800/50 dark:text-slate-500'
}

// ── derived ───────────────────────────────────────────────────────────────────
const filteredAttendees = computed(() => {
  const f = TABS[activeTab.value].filter
  let list: Attendee[] = !f
    ? [...attendees.value]
    : f === 'pending'
      ? attendees.value.filter(a => !a.status)
      : attendees.value.filter(a => a.status === f)

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(a =>
      `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
      (a.email as string ?? '').toLowerCase().includes(q) ||
      (a.cluster_value as string ?? '').toLowerCase().includes(q)
    )
  }

  list.sort((a, b) => {
    let av = '', bv = ''
    if (sortField.value === 'name') {
      av = `${a.first_name} ${a.last_name}`.toLowerCase()
      bv = `${b.first_name} ${b.last_name}`.toLowerCase()
    } else if (sortField.value === 'email') {
      av = (a.email as string ?? '').toLowerCase()
      bv = (b.email as string ?? '').toLowerCase()
    } else if (sortField.value === 'status') {
      av = (a.status as string ?? '')
      bv = (b.status as string ?? '')
    } else {
      av = (a.actioned_at as string ?? '')
      bv = (b.actioned_at as string ?? '')
    }
    const cmp = av.localeCompare(bv)
    return sortDir.value === 'asc' ? cmp : -cmp
  })

  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredAttendees.value.length / PAGE_SIZE)))

const paginatedAttendees = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredAttendees.value.slice(start, start + PAGE_SIZE)
})

function toggleSort(field: typeof sortField.value) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = 'asc'
  }
  currentPage.value = 1
}

watch(searchQuery, () => { currentPage.value = 1 })

function countForTab(filter: string | null) {
  if (!filter) return attendees.value.length
  if (filter === 'pending') return attendees.value.filter(a => !a.status).length
  return attendees.value.filter(a => a.status === filter).length
}

// ── data fetching ─────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}`, { headers: authHeaders() })
    const data = await res.json() as { status: string; message?: string; event?: EventInfo }
    if (!res.ok) throw new Error(data.message ?? 'Event not found.')

    if (!data.event!.isLead) { router.replace(`/tix/${slug}`); return }

    // Redirect to selection wizard if not yet finalized
    if (!data.event!.selectionLocked) { router.replace(`/manage/tix/${slug}/select`); return }

    event.value = data.event!
  } catch {
    event.value = null
    loadingEvent.value = false
    return
  }
  loadingEvent.value = false
  fetchAttendees()
  fetchClusters()
  fetchCsvMeta()
})

async function fetchAttendees() {
  loadingAttendees.value = true
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}/attendees`, { headers: authHeaders() })
    const data = await res.json() as { status: string; message?: string; attendees?: Attendee[] }
    if (!res.ok) throw new Error(data.message ?? 'Failed to load attendees.')
    attendees.value = data.attendees ?? []
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to load attendees.')
  } finally {
    loadingAttendees.value = false
  }
}

async function fetchClusters() {
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}/clusters`, { headers: authHeaders() })
    if (!res.ok) return
    const data = await res.json() as { clusters?: typeof clusters.value }
    clusters.value = data.clusters ?? []
  } catch { /* clusters are optional */ }
}

async function fetchCsvMeta() {
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}/csv-data`, { headers: authHeaders() })
    if (!res.ok) return
    const data = await res.json() as { rows?: unknown[]; columnMapping?: typeof csvColMapping }
    hasCsvRows.value = (data.rows?.length ?? 0) > 0
    if (data.columnMapping) {
      csvColMapping = data.columnMapping
      // Default to search tab when CSV exists
      guestMode.value = hasCsvRows.value ? 'search' : 'freeform'
    }
  } catch { /* no CSV is fine */ }
}

// ── actions ───────────────────────────────────────────────────────────────────
async function checkin(attendeeId: string)  { await doAction('checkin-manual', { attendeeId }) }
async function checkout(attendeeId: string) { await doAction('checkout', { attendeeId }) }
async function remove(attendeeId: string)   { await doAction('remove',   { attendeeId }) }

async function doAction(action: string, body: object) {
  actionPending.value = action
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}/${action}`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
    })
    const data = await res.json() as { status: string; message: string }
    if (!res.ok) throw new Error(data.message)
    toast.success(data.message)
    await fetchAttendees()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Action failed.')
  } finally {
    actionPending.value = ''
  }
}

function isApcAttendee(a: Attendee) {
  const cv = (a.cluster_value as string ?? '').toLowerCase()
  return cv.includes('asia pacific college') || cv.includes('jpcs')
}

async function exportToXlsx() {
  if (!attendees.value.length) return
  exportingXlsx.value = true
  try {
    const XLSX = await import('xlsx')
    const toRow = (a: Attendee) => {
      const fn = (a.first_name as string ?? '').trim()
      const ln = (a.last_name as string ?? '').trim()
      const qrFileName = `${fn}_${ln}`.replace(/[^a-zA-Z0-9_]/g, '_') + '.png'
      return {
        'First Name':        fn,
        'Last Name':         ln,
        'Email Address':     (a.email as string ?? '').trim(),
        'Cluster':           (a.cluster_value as string ?? '').trim(),
        'QR Code File Name': qrFileName,
      }
    }
    const active = attendees.value.filter(a => a.status !== 'removed')
    const apc    = active.filter(a =>  isApcAttendee(a)).map(toRow)
    const nonApc = active.filter(a => !isApcAttendee(a)).map(toRow)

    const wbApc = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wbApc, XLSX.utils.json_to_sheet(apc), 'APC Attendees')
    XLSX.writeFile(wbApc, `${slug}-attendees-apc.xlsx`)

    const wbOther = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wbOther, XLSX.utils.json_to_sheet(nonApc), 'Other Attendees')
    XLSX.writeFile(wbOther, `${slug}-attendees-non-apc.xlsx`)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Export failed.')
  } finally {
    exportingXlsx.value = false
  }
}

async function confirmDeleteEvent() {
  if (!confirm(`Delete "${event.value?.name}"?\n\nThis will permanently remove all attendees and their data. This cannot be undone.`)) return
  deletingEvent.value = true
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    const data = await res.json() as { status: string; message?: string }
    if (!res.ok) throw new Error(data.message ?? 'Delete failed.')
    toast.success('Event deleted.')
    router.push('/manage/tix')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Delete failed.')
  } finally {
    deletingEvent.value = false
  }
}

onUnmounted(() => stopScanner())
</script>

<style scoped>
.panel-enter-active, .panel-leave-active { transition: opacity 0.2s; }
.panel-enter-active .relative, .panel-leave-active .relative { transition: transform 0.25s ease; }
.panel-enter-from, .panel-leave-to { opacity: 0; }
.panel-enter-from .relative, .panel-leave-to .relative { transform: translateX(100%); }
</style>
