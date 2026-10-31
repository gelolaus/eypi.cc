<template>
  <Dialog
    :open="open"
    @update:open="onOpenChange"
  >
    <DialogContent class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Choose your avatar</DialogTitle>
        <DialogDescription>Pick an icon and a colour. Others see it next to your name.</DialogDescription>
      </DialogHeader>

      <div class="flex justify-center">
        <UserAvatar
          data-avatar-preview
          :name="displayName"
          :icon="icon"
          :color="color"
          class="size-20"
        />
      </div>

      <div class="grid grid-cols-1 gap-2">
        <p
          class="text-base font-medium"
        >
          Icon
        </p>
        <div
          role="radiogroup"
          aria-label="Icon"
          class="grid grid-cols-6 gap-1"
        >
          <button
            v-for="(key, index) in AVATAR_ICONS"
            :key="key"
            :ref="(el) => (iconButtons[index] = el as HTMLButtonElement | null)"
            type="button"
            role="radio"
            :data-value="key"
            :aria-label="key.replace(/-/g, ' ')"
            :aria-checked="icon === key"
            :tabindex="iconTabbable(index) ? 0 : -1"
            :class="cn(
              'relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-transparent outline-none transition hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50',
              icon === key ? 'border-primary bg-muted text-foreground ring-2 ring-primary' : 'text-muted-foreground',
            )"
            @click="icon = key"
            @keydown="onKeydown($event, index, AVATAR_ICONS, iconButtons, (v) => (icon = v))"
          >
            <component
              :is="AVATAR_ICON_COMPONENTS[key]"
              class="size-5"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2">
        <p class="text-base font-medium">
          Colour
        </p>
        <div
          role="radiogroup"
          aria-label="Colour"
          class="flex flex-wrap gap-1"
        >
          <button
            v-for="(key, index) in AVATAR_COLORS"
            :key="key"
            :ref="(el) => (colorButtons[index] = el as HTMLButtonElement | null)"
            type="button"
            role="radio"
            :data-value="key"
            :aria-label="key"
            :aria-checked="color === key"
            :tabindex="colorTabbable(index) ? 0 : -1"
            :class="cn(
              'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-transparent outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50',
              color === key ? 'ring-2 ring-primary ring-offset-2 ring-offset-popover' : '',
            )"
            @click="color = key"
            @keydown="onKeydown($event, index, AVATAR_COLORS, colorButtons, (v) => (color = v))"
          >
            <span
              class="flex size-8 items-center justify-center rounded-full"
              :style="{ backgroundColor: `var(--avatar-${key})` }"
            >
              <Check
                v-if="color === key"
                class="size-4 text-background"
                aria-hidden="true"
              />
            </span>
          </button>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button
          type="button"
          variant="ghost"
          :disabled="saving"
          @click="resetAvatar"
        >
          Reset
        </Button>
        <Button
          type="button"
          :disabled="!canSave"
          @click="saveAvatar"
        >
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Check } from 'lucide-vue-next'
import { AVATAR_COLORS, AVATAR_ICONS, isAvatarColor, isAvatarIcon, type AvatarColor, type AvatarIcon } from '@shared/avatars'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/composables/useToast'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useSession } from '@/stores/session'
import UserAvatar from './UserAvatar.vue'
import { AVATAR_ICON_COMPONENTS } from './avatarIcons'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const session = useSession()
const toast = useToast()

const icon = ref<AvatarIcon | null>(null)
const color = ref<AvatarColor | null>(null)
const saving = ref(false)
const iconButtons: Array<HTMLButtonElement | null> = []
const colorButtons: Array<HTMLButtonElement | null> = []

const displayName = computed(() => {
  const current = session.user.value
  const name = current?.name?.trim() || (current?.email ? current.email.split('@')[0] : '')
  return name || 'Account'
})

const canSave = computed(() => icon.value !== null && color.value !== null && !saving.value)

/** Start from the signed-in user's avatar each time the dialog opens. */
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    const user = session.user.value
    icon.value = isAvatarIcon(user?.avatarIcon) ? user.avatarIcon : null
    color.value = isAvatarColor(user?.avatarColor) ? user.avatarColor : null
  },
  { immediate: true },
)

/** The selected radio is the tab stop; with none selected the first one is. */
const iconTabbable = (index: number) => (icon.value ? AVATAR_ICONS[index] === icon.value : index === 0)
const colorTabbable = (index: number) => (color.value ? AVATAR_COLORS[index] === color.value : index === 0)

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

function onKeydown<T extends string>(
  event: KeyboardEvent,
  index: number,
  keys: readonly T[],
  buttons: Array<HTMLButtonElement | null>,
  select: (value: T) => void,
) {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  const step = STEP[event.key]
  if (!step) return
  event.preventDefault()
  const next = (index + step + keys.length) % keys.length
  select(keys[next])
  void nextTick(() => buttons[next]?.focus())
}

/** Escape, the overlay and the X all land here; closing mid-save would let the late success emit close a reopened dialog. */
function onOpenChange(value: boolean) {
  if (!value && saving.value) return
  emit('update:open', value)
}

async function send(next: { icon: AvatarIcon; color: AvatarColor } | { icon: null; color: null }, done: string) {
  if (saving.value) return
  saving.value = true
  try {
    await api.patch('/api/account/avatar', { icon: next.icon, color: next.color })
    session.setAvatar(next.icon, next.color)
    toast.success(done)
    emit('update:open', false)
  } catch {
    toast.error('Could not save your avatar. Try again.')
  } finally {
    saving.value = false
  }
}

function saveAvatar() {
  if (icon.value && color.value) void send({ icon: icon.value, color: color.value }, 'Avatar updated')
}

function resetAvatar() {
  void send({ icon: null, color: null }, 'Avatar reset')
}
</script>
