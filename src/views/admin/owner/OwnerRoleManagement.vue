<template>
  <div class="flex min-h-screen bg-slate-950 owner-theme text-white">
    <OwnerSidebar />

    <main class="flex-1 px-4 py-6 md:px-8">
      <div class="mx-auto max-w-7xl space-y-6">
        <section class="rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_38%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.96))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)]">
          <div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">Clinic Admin</p>
              <h1 class="mt-2 text-3xl font-bold tracking-tight text-white">Role Management</h1>
              <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Create clinic-owned staff roles, keep role records organized in tabs, and save permission sets without involving super admin.
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="loading"
                @click="loadRoles()"
              >
                <Icon icon="mdi:refresh" class="h-5 w-5" />
                Refresh
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                @click="openAddTab"
              >
                <Icon icon="mdi:plus" class="h-5 w-5" />
                Add Role
              </button>
            </div>
          </div>

          <div class="mt-6 grid gap-4 md:grid-cols-3">
            <article
              v-for="card in statsCards"
              :key="card.label"
              class="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"
            >
              <p class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ card.label }}</p>
              <div v-if="loading" class="mt-3 h-8 w-20 animate-pulse rounded-lg bg-slate-800"></div>
              <p v-else class="mt-2 text-2xl font-semibold text-white">{{ card.value }}</p>
              <p class="mt-1 text-sm text-slate-400">{{ card.description }}</p>
            </article>
          </div>
        </section>

        <section class="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/90 shadow-[0_24px_60px_rgba(2,6,23,0.45)]">
          <div class="border-b border-slate-800 px-4 py-4 sm:px-6">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                type="button"
                class="tab-button"
                :class="{ 'tab-button-active': activeTab === tab.key }"
                :disabled="tab.disabled"
                @click="activeTab = tab.key"
              >
                <Icon :icon="tab.icon" class="h-4 w-4" />
                {{ tab.label }}
              </button>
            </div>
          </div>

          <div class="grid min-h-[38rem] gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside class="border-b border-slate-800 bg-slate-950/70 xl:border-b-0 xl:border-r">
              <div class="border-b border-slate-800 px-5 py-4">
                <p class="text-xs uppercase tracking-[0.18em] text-slate-500">Role Directory</p>
                <h2 class="mt-1 text-lg font-semibold text-slate-100">Created Roles</h2>
                <p class="mt-1 text-sm text-slate-400">Select a role to view details or update permissions.</p>
              </div>

              <div v-if="loading" class="space-y-3 p-4">
                <div v-for="item in 4" :key="item" class="h-20 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70"></div>
              </div>

              <div v-else-if="!roles.length" class="p-5">
                <div class="rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 px-4 py-8 text-center">
                  <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-cyan-300">
                    <Icon icon="mdi:shield-outline" class="h-7 w-7" />
                  </div>
                  <h3 class="mt-4 text-base font-semibold text-slate-100">No roles yet created</h3>
                  <p class="mt-2 text-sm leading-6 text-slate-400">
                    Start by adding your first clinic role. It will appear here once saved.
                  </p>
                  <button
                    type="button"
                    class="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                    @click="openAddTab"
                  >
                    <Icon icon="mdi:plus" class="h-4 w-4" />
                    Create First Role
                  </button>
                </div>
              </div>

              <div v-else class="space-y-3 p-4">
                <button
                  v-for="role in roles"
                  :key="role.id"
                  type="button"
                  class="role-list-item"
                  :class="{ 'role-list-item-active': selectedRoleId === role.id }"
                  @click="selectRole(role.id)"
                >
                  <div class="flex min-w-0 items-center gap-3">
                    <span class="role-swatch" :style="{ background: role.color || '#38bdf8' }"></span>
                    <div class="min-w-0 text-left">
                      <p class="truncate text-sm font-semibold text-slate-100">{{ role.name }}</p>
                      <p class="truncate text-xs text-slate-400">{{ role.memberCount }} assigned staff</p>
                    </div>
                  </div>
                  <span
                    v-if="role.permissions.length === 0"
                    class="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300"
                  >
                    Needs permissions
                  </span>
                  <Icon icon="mdi:chevron-right" class="h-5 w-5 flex-shrink-0 text-slate-500" />
                </button>
              </div>
            </aside>

            <div class="min-h-0 overflow-y-auto bg-slate-900/70">
              <div v-if="loading" class="p-5 sm:p-6">
                <div class="space-y-5 rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-5">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div class="space-y-3">
                      <div class="h-4 w-28 animate-pulse rounded bg-slate-800"></div>
                      <div class="h-7 w-56 animate-pulse rounded bg-slate-800"></div>
                      <div class="h-4 w-80 max-w-full animate-pulse rounded bg-slate-800"></div>
                    </div>
                    <div class="h-10 w-32 animate-pulse rounded-xl bg-slate-800"></div>
                  </div>

                  <div class="grid gap-4 lg:grid-cols-2">
                    <div
                      v-for="item in 4"
                      :key="`role-skeleton-${item}`"
                      class="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                    >
                      <div class="flex items-start justify-between gap-4">
                        <div class="flex items-center gap-3">
                          <div class="h-4 w-4 animate-pulse rounded-full bg-slate-800"></div>
                          <div class="space-y-2">
                            <div class="h-4 w-36 animate-pulse rounded bg-slate-800"></div>
                            <div class="h-3 w-24 animate-pulse rounded bg-slate-800"></div>
                          </div>
                        </div>
                        <div class="h-6 w-20 animate-pulse rounded-full bg-slate-800"></div>
                      </div>
                      <div class="mt-4 h-4 w-full animate-pulse rounded bg-slate-800"></div>
                      <div class="mt-2 h-4 w-4/5 animate-pulse rounded bg-slate-800"></div>
                      <div class="mt-4 flex gap-2">
                        <div class="h-6 w-28 animate-pulse rounded-full bg-slate-800"></div>
                        <div class="h-6 w-20 animate-pulse rounded-full bg-slate-800"></div>
                      </div>
                      <div class="mt-5 flex gap-2">
                        <div class="h-10 w-28 animate-pulse rounded-xl bg-slate-800"></div>
                        <div class="h-10 w-32 animate-pulse rounded-xl bg-slate-800"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="activeTab === 'roles'" class="p-5 sm:p-6">
                <div class="rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-5">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">Roles Overview</p>
                      <h3 class="mt-1 text-xl font-semibold text-white">Clinic Role Library</h3>
                      <p class="mt-2 text-sm text-slate-400">This tab shows the roles already created for your clinic admin account.</p>
                    </div>
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                      @click="openAddTab"
                    >
                      <Icon icon="mdi:plus" class="h-4 w-4" />
                      Add New Role
                    </button>
                  </div>

                  <div v-if="!roles.length" class="mt-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/80 px-5 py-12 text-center">
                    <Icon icon="mdi:shield-off-outline" class="mx-auto h-12 w-12 text-slate-500" />
                    <h4 class="mt-4 text-lg font-semibold text-slate-100">No roles yet created</h4>
                    <p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
                      The clinic admin has not created any custom staff roles yet. Use the add tab to start building your role setup.
                    </p>
                  </div>

                  <div v-else class="mt-6 grid gap-4 lg:grid-cols-2">
                    <article
                      v-for="role in roles"
                      :key="`card-${role.id}`"
                      class="rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-600"
                    >
                      <div class="flex items-start justify-between gap-4">
                        <div class="flex min-w-0 items-center gap-3">
                          <span class="role-swatch h-4 w-4" :style="{ background: role.color || '#38bdf8' }"></span>
                          <div class="min-w-0">
                            <h4 class="truncate text-base font-semibold text-white">{{ role.name }}</h4>
                            <p class="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">Custom Clinic Role</p>
                          </div>
                        </div>
                        <span class="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          {{ role.memberCount }} staff
                        </span>
                      </div>
                      <p class="mt-4 min-h-[3rem] text-sm leading-6 text-slate-400">{{ role.description || 'No description added yet.' }}</p>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <span class="rounded-full bg-slate-950 px-3 py-1 text-xs text-slate-300">
                          {{ role.permissions.length }} permissions enabled
                        </span>
                        <span class="rounded-full px-3 py-1 text-xs font-medium" :style="{ background: `${role.color || '#38bdf8'}22`, color: role.color || '#38bdf8' }">
                          {{ role.color || '#38bdf8' }}
                        </span>
                      </div>
                      <div class="mt-5 flex flex-wrap gap-2">
                        <button type="button" class="ghost-action" @click="openDetails(role.id)">Role Details</button>
                        <button type="button" class="ghost-action" @click="openPermissions(role.id)">Set Permissions</button>
                        <button type="button" class="danger-action" @click="removeRole(role.id)">Delete</button>
                      </div>
                    </article>
                  </div>
                </div>
              </div>

              <div v-else-if="activeTab === 'add'" class="p-5 sm:p-6">
                <div class="mx-auto max-w-3xl rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-5 sm:p-6">
                  <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">New Role</p>
                  <h3 class="mt-1 text-xl font-semibold text-white">Add a Clinic Role</h3>
                  <p class="mt-2 text-sm text-slate-400">
                    Create a role record first. After saving it, move to the permissions tab to define what that role can access.
                  </p>

                  <form class="mt-6 space-y-5" @submit.prevent="createRole">
                    <label class="field-block">
                      <span class="field-label">Role Name</span>
                      <input v-model.trim="newRole.name" type="text" class="discord-input" placeholder="e.g. Head Receptionist" />
                    </label>

                    <label class="field-block">
                      <span class="field-label">Description</span>
                      <textarea
                        v-model.trim="newRole.description"
                        rows="4"
                        class="discord-input discord-textarea"
                        placeholder="Describe what this role is responsible for."
                      ></textarea>
                    </label>

                    <div class="field-block">
                      <span class="field-label">Role Color</span>
                      <div class="grid grid-cols-5 gap-2 sm:grid-cols-10">
                        <button
                          v-for="color in colorPresets"
                          :key="`new-${color}`"
                          type="button"
                          class="color-chip"
                          :class="{ 'color-chip-active': newRole.color === color }"
                          :style="{ background: color }"
                          @click="newRole.color = color"
                        ></button>
                      </div>
                    </div>

                    <div class="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <p class="text-sm font-semibold text-slate-100">Preview</p>
                      <div class="mt-3 flex items-center gap-3">
                        <span class="role-swatch h-4 w-4" :style="{ background: newRole.color }"></span>
                        <span class="text-base font-semibold" :style="{ color: newRole.color }">{{ newRole.name || 'New Role' }}</span>
                      </div>
                    </div>

                    <div class="flex flex-wrap justify-end gap-3">
                      <button type="button" class="ghost-action" @click="resetNewRole">Reset</button>
                      <button
                        type="submit"
                        class="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                        :disabled="saving"
                      >
                        <Icon icon="mdi:content-save-outline" class="h-4 w-4" />
                        Save Role
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div v-else-if="activeTab === 'details'" class="p-5 sm:p-6">
                <div v-if="selectedRole" class="mx-auto max-w-4xl rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-5 sm:p-6">
                  <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div class="flex items-center gap-4">
                      <div class="role-badge" :style="{ background: selectedRoleDraft.color }">
                        <Icon icon="mdi:shield-account-outline" class="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">Role Details</p>
                        <h3 class="mt-1 text-xl font-semibold text-white">{{ selectedRoleDraft.name || 'Untitled Role' }}</h3>
                        <p class="mt-2 text-sm text-slate-400">Update the role profile before assigning or managing permissions.</p>
                      </div>
                    </div>
                    <button type="button" class="danger-action" @click="removeRole(selectedRole.id)">Delete Role</button>
                  </div>

                  <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div class="space-y-5">
                      <label class="field-block">
                        <span class="field-label">Role Name</span>
                        <input v-model.trim="selectedRoleDraft.name" type="text" class="discord-input" />
                      </label>

                      <label class="field-block">
                        <span class="field-label">Description</span>
                        <textarea v-model.trim="selectedRoleDraft.description" rows="5" class="discord-input discord-textarea"></textarea>
                      </label>

                      <div class="flex flex-wrap justify-end gap-3">
                        <button type="button" class="ghost-action" @click="resetSelectedDraft">Discard Changes</button>
                        <button
                          type="button"
                          class="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                          :disabled="saving"
                          @click="saveRoleDetails"
                        >
                          <Icon icon="mdi:content-save-outline" class="h-4 w-4" />
                          Save Details
                        </button>
                      </div>
                    </div>

                    <div class="space-y-5">
                      <div class="field-block">
                        <span class="field-label">Role Color</span>
                        <div class="grid grid-cols-5 gap-2">
                          <button
                            v-for="color in colorPresets"
                            :key="`selected-${color}`"
                            type="button"
                            class="color-chip"
                            :class="{ 'color-chip-active': selectedRoleDraft.color === color }"
                            :style="{ background: color }"
                            @click="selectedRoleDraft.color = color"
                          ></button>
                        </div>
                      </div>

                      <div class="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <p class="field-label">Live Preview</p>
                        <div class="mt-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                          <div class="flex items-center gap-3">
                            <span class="role-swatch h-4 w-4" :style="{ background: selectedRoleDraft.color }"></span>
                            <span class="font-semibold" :style="{ color: selectedRoleDraft.color }">{{ selectedRoleDraft.name || 'Untitled Role' }}</span>
                          </div>
                          <p class="mt-3 text-xs leading-5 text-slate-500">{{ selectedRoleDraft.description || 'No description added yet.' }}</p>
                        </div>
                      </div>

                      <div class="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <p class="field-label">Assigned Staff</p>
                        <p class="mt-2 text-2xl font-semibold text-white">{{ selectedRole.memberCount }}</p>
                        <p class="mt-1 text-sm text-slate-400">Members currently linked to this custom role.</p>
                      </div>

                      <div class="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                        <p class="field-label text-amber-200">Permission DSS</p>
                        <p class="mt-2 text-sm text-amber-50">
                          <span v-if="selectedRoleDraft.permissions.length">
                            This role already has {{ selectedRoleDraft.permissions.length }} permission<span v-if="selectedRoleDraft.permissions.length !== 1">s</span> enabled.
                            It can be assigned to staff.
                          </span>
                          <span v-else>
                            This role still has no permissions, so it will stay hidden from staff assignment until at least one permission is enabled.
                          </span>
                        </p>
                        <div v-if="selectedRoleDraft.permissions.length === 0" class="mt-4 space-y-3">
                          <div v-if="suggestedPermissions.length" class="space-y-2">
                            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Suggested starting permissions</p>
                            <div class="flex flex-wrap gap-2">
                              <span
                                v-for="permission in suggestedPermissions"
                                :key="permission"
                                class="rounded-full border border-amber-200/20 bg-slate-950/70 px-3 py-1 text-xs text-amber-50"
                              >
                                {{ permissionLabel(permission) }}
                              </span>
                            </div>
                          </div>
                          <p class="text-xs leading-5 text-amber-100/80">
                            Tip: enable at least one permission before assigning this role to staff.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="activeTab === 'permissions'" class="p-5 sm:p-6">
                <div v-if="selectedRole" class="mx-auto max-w-5xl rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-5 sm:p-6">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">Permissions</p>
                      <h3 class="mt-1 text-xl font-semibold text-white">{{ selectedRoleDraft.name || selectedRole.name }}</h3>
                      <p class="mt-2 text-sm text-slate-400">Turn access on or off, then save the permission set for this role.</p>
                    </div>
                    <span class="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                      {{ selectedPermissionsCount }}/{{ allPermissionKeys.length }} enabled
                    </span>
                  </div>

                  <div class="mt-6 space-y-5">
                    <div
                      v-if="selectedRoleDraft.permissions.length === 0"
                      class="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4"
                    >
                      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Permission DSS</p>
                          <p class="mt-2 text-sm leading-6 text-amber-50">
                            This role has no permissions yet, so it will not appear in the staff assignment dropdown until at least one permission is saved.
                          </p>
                        </div>
                        <span class="rounded-full border border-amber-200/20 bg-slate-950/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-200">
                          Action needed
                        </span>
                      </div>
                      <div v-if="suggestedPermissions.length" class="mt-4">
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Suggested permissions</p>
                        <div class="mt-3 flex flex-wrap gap-2">
                          <span
                            v-for="permission in suggestedPermissions"
                            :key="permission"
                            class="rounded-full border border-amber-200/20 bg-slate-950/70 px-3 py-1 text-xs text-amber-50"
                          >
                            {{ permissionLabel(permission) }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <article
                      v-for="group in permissionGroups"
                      :key="group.key"
                      class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
                    >
                      <div class="border-b border-slate-800 px-4 py-4">
                        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h4 class="text-sm font-semibold text-slate-100">{{ group.label }}</h4>
                            <p class="text-xs text-slate-500">{{ group.description }}</p>
                          </div>
                          <span class="rounded-full bg-slate-950 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                            {{ enabledCountForGroup(group) }}/{{ group.permissions.length }} enabled
                          </span>
                        </div>
                      </div>

                      <div class="divide-y divide-slate-800">
                        <div
                          v-for="permission in group.permissions"
                          :key="permission.key"
                          class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div class="flex min-w-0 items-start gap-3">
                            <span class="mt-0.5 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-cyan-300">
                              <Icon :icon="permission.icon" class="h-5 w-5" />
                            </span>
                            <div class="min-w-0">
                              <p class="text-sm font-medium text-slate-100">{{ permission.label }}</p>
                              <p class="text-xs leading-5 text-slate-500">{{ permission.description }}</p>
                            </div>
                          </div>

                          <div class="flex flex-col items-end gap-2">
                            <button
                              type="button"
                              class="discord-switch"
                              :class="{
                                'discord-switch-on': isPermissionEnabled(permission.key),
                                'opacity-50 cursor-not-allowed': isPermissionLocked(permission.key) || isDefaultPermission(permission.key)
                              }"
                              :aria-pressed="isPermissionEnabled(permission.key)"
                              :disabled="isPermissionLocked(permission.key) || isDefaultPermission(permission.key)"
                              @click="togglePermission(permission.key)"
                            >
                              <span class="discord-switch-thumb"></span>
                            </button>
                            <div
                              v-if="isDefaultPermission(permission.key)"
                              class="text-right text-[11px] uppercase tracking-[0.18em] text-cyan-300"
                            >
                              Default access
                            </div>
                            <div
                              v-else-if="isPermissionLocked(permission.key)"
                              class="text-right text-[11px] uppercase tracking-[0.18em] text-amber-300"
                            >
                              Locked by current plan
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  </div>

                  <div class="mt-6 flex flex-wrap justify-end gap-3">
                    <button type="button" class="ghost-action" @click="resetSelectedDraft">Discard Changes</button>
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="saving"
                      @click="saveRolePermissions"
                    >
                      <Icon icon="mdi:content-save-outline" class="h-4 w-4" />
                      Save Permissions
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from 'firebase/firestore'
import { toast } from 'vue3-toastify'
import Swal from 'sweetalert2'
import OwnerSidebar from '@/components/sidebar/OwnerSidebar.vue'
import { useSubscription } from '@/composables/useSubscription'
import { auth, db } from '@/config/firebaseConfig'

const colorPresets = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#3BA55D', '#1ABC9C', '#FAA61A', '#2D7DFA', '#A56EFF']
const defaultPermissionKeys = new Set([])
const fullAccessPermissionKey = 'administrator:full_access'

const permissionGroups = [
  {
    key: 'clinic-setup',
    label: 'Clinic Setup',
    description: 'Branch setup, clinic profile, and structure-related access.',
    permissions: [
      { key: 'clinic_profile:view', label: 'View Clinic Profile', description: 'Open clinic profile management.', icon: 'mdi:domain' },
      { key: 'clinic_profile:update', label: 'Update Clinic Profile', description: 'Edit clinic page and public presentation.', icon: 'mdi:file-document-edit-outline' },
      { key: 'branches:view', label: 'View Branches', description: 'Open branch information pages.', icon: 'mdi:source-branch' },
      { key: 'branches:create', label: 'Create Branches', description: 'Add and configure clinic branches.', icon: 'mdi:map-marker-plus-outline' },
    ],
  },
  {
    key: 'team-management',
    label: 'Team Management',
    description: 'Controls for employee records, creation, and role maintenance.',
    permissions: [
      { key: 'staff:view', label: 'View Staff', description: 'Open employee profiles and staff listings.', icon: 'mdi:account-group-outline' },
      { key: 'staff:create', label: 'Create Staff', description: 'Add employee accounts under the clinic.', icon: 'mdi:account-plus-outline' },
      { key: 'staff:update', label: 'Update Staff', description: 'Edit staff details and role assignments.', icon: 'mdi:account-edit-outline' },
      { key: 'attendance:view', label: 'View Attendance', description: 'See attendance records and logs.', icon: 'mdi:clipboard-text-clock-outline' },
      { key: 'attendance:create', label: 'Create Attendance', description: 'Record attendance entries and attendance actions.', icon: 'mdi:calendar-check-outline' },
    ],
  },
  {
    key: 'clinic-workspace',
    label: 'Clinic Workspace',
    description: 'Customer-facing scheduling, client access, and consultation flow.',
    permissions: [
      { key: 'clients:view', label: 'View Clients', description: 'Access client records and profiles.', icon: 'mdi:account-heart-outline' },
      { key: 'clients:create', label: 'Create Clients', description: 'Add new client records.', icon: 'mdi:account-plus-outline' },
      { key: 'appointments:view', label: 'View Appointments', description: 'See appointment listings and schedules.', icon: 'mdi:calendar-month-outline' },
      { key: 'appointments:create', label: 'Create Appointments', description: 'Create or reschedule appointments.', icon: 'mdi:calendar-plus-outline' },
      { key: 'appointments:review', label: 'Review Appointment Requests', description: 'Approve or reject cancellation and reschedule requests.', icon: 'mdi:calendar-check-outline' },
      { key: 'inbox:view', label: 'View Inbox', description: 'Access branch inbox and messages.', icon: 'mdi:inbox-outline' },
      { key: 'consultations:view', label: 'View Online Consultations', description: 'Access online consultation screens.', icon: 'mdi:video-outline' },
    ],
  },
  {
    key: 'products-services',
    label: 'Products & Services',
    description: 'Inventory, purchase requests, and service listings.',
    permissions: [
      { key: 'inventory:view', label: 'View Inventory', description: 'Open suppliers, catalog, and inventory pages.', icon: 'mdi:package-variant-closed' },
      { key: 'inventory:create', label: 'Create Inventory Requests', description: 'Create purchase requests and inventory actions.', icon: 'mdi:cart-plus' },
      { key: 'inventory:review', label: 'Review Inventory Requests', description: 'Approve, reject, and manage purchase request actions.', icon: 'mdi:cart-check' },
      { key: 'orders:view', label: 'View Orders', description: 'Open branch order tracking.', icon: 'mdi:cart-outline' },
      { key: 'services:view', label: 'View Services', description: 'Access product and service listings.', icon: 'mdi:tag-outline' },
    ],
  },
  {
    key: 'hr-workspace',
    label: 'HR Workspace',
    description: 'HR screens, schedules, leave, and payroll tools.',
    permissions: [
      { key: 'hr:view', label: 'View HR', description: 'Open HR records and shift-related pages.', icon: 'mdi:badge-account-outline' },
      { key: 'hr:create', label: 'Create HR Entries', description: 'Create HR-related records.', icon: 'mdi:clipboard-plus-outline' },
      { key: 'hr:update', label: 'Update HR', description: 'Modify schedules and assignments.', icon: 'mdi:clipboard-edit-outline' },
      { key: 'leave:create', label: 'Create Leave Requests', description: 'Submit leave requests.', icon: 'mdi:file-plus-outline' },
      { key: 'leave:review', label: 'Review Leave Requests', description: 'Approve or reject leave requests.', icon: 'mdi:calendar-check-outline' },
      { key: 'payroll:update', label: 'Update Payroll', description: 'Adjust payroll settings and payslips.', icon: 'mdi:cash-edit' },
    ],
  },
  {
    key: 'finance-workspace',
    label: 'Finance Workspace',
    description: 'Sales, payments, analytics, and reports access.',
    permissions: [
      { key: 'payments:view', label: 'View Payments', description: 'Open transaction history and sales records.', icon: 'mdi:cash-multiple' },
      { key: 'payments:create', label: 'Create Payments', description: 'Process POS or payment entries.', icon: 'mdi:cash-register' },
      { key: 'reports:view', label: 'View Reports', description: 'Access clinic performance and reports.', icon: 'mdi:chart-box-outline' },
      { key: 'payroll:view', label: 'View Payroll Summary', description: 'Open payroll summaries and payroll approval screens.', icon: 'mdi:file-chart-outline' },
    ],
  },
  {
    key: 'account-system',
    label: 'Account & System',
    description: 'Subscription, module access, notifications, and support tools.',
    permissions: [
      { key: fullAccessPermissionKey, label: 'Administrator Full Access', description: 'Unlock every permission in the clinic workspace.', icon: 'mdi:key-star' },
      { key: 'subscription:view', label: 'View Subscription', description: 'Open the clinic subscription plan screen.', icon: 'mdi:card-outline' },
      { key: 'backup:view', label: 'View Backup', description: 'Access database backup tools.', icon: 'mdi:file-download-outline' },
      { key: 'profile:view', label: 'View Profile', description: 'Open employee profile pages.', icon: 'mdi:card-account-details-outline' },
      { key: 'password:update', label: 'Change Password', description: 'Access password reset and change screens.', icon: 'mdi:shield-key-outline' },
      { key: 'activities:view', label: 'View Activities', description: 'Open user activity pages and logs.', icon: 'mdi:history' },
      { key: 'notifications:view', label: 'View Notifications', description: 'Access in-app notifications.', icon: 'mdi:bell-outline' },
      { key: 'support:view', label: 'View Support', description: 'Open support and issue reporting pages.', icon: 'mdi:lifebuoy' },
    ],
  },
]

const allPermissionKeys = permissionGroups.flatMap((group) => group.permissions.map((permission) => permission.key))
const permissionLabelMap = permissionGroups.reduce((acc, group) => {
  group.permissions.forEach((permission) => {
    acc[permission.key] = permission.label
  })
  return acc
}, {})

const permissionSuggestionRules = [
  {
    match: ['reception', 'front desk', 'frontdesk', 'receptionist', 'desk'],
    permissions: ['appointments:view', 'appointments:create', 'clients:view', 'clients:create', 'inbox:view', 'notifications:view', 'support:view', 'profile:view', 'password:update'],
  },
  {
    match: ['practitioner', 'doctor', 'dentist', 'nurse', 'therapist', 'clinician'],
    permissions: ['appointments:view', 'appointments:review', 'clients:view', 'consultations:view', 'leave:create', 'notifications:view', 'support:view', 'profile:view', 'password:update'],
  },
  {
    match: ['hr', 'human resources'],
    permissions: ['staff:view', 'staff:create', 'staff:update', 'attendance:view', 'attendance:create', 'hr:view', 'hr:create', 'hr:update', 'leave:create', 'leave:review', 'notifications:view', 'support:view', 'profile:view', 'password:update'],
  },
  {
    match: ['finance', 'accounting', 'cashier'],
    permissions: ['payments:view', 'payments:create', 'reports:view', 'payroll:view', 'leave:create', 'notifications:view', 'support:view', 'profile:view', 'password:update'],
  },
  {
    match: ['manager', 'operations', 'supervisor'],
    permissions: ['staff:view', 'appointments:view', 'inventory:view', 'inventory:review', 'orders:view', 'services:view', 'reports:view', 'leave:create', 'leave:review', 'notifications:view', 'support:view', 'profile:view', 'password:update'],
  },
  {
    match: ['supply', 'inventory', 'warehouse', 'stock'],
    permissions: ['inventory:view', 'inventory:create', 'inventory:review', 'orders:view', 'notifications:view', 'support:view', 'profile:view', 'password:update'],
  },
  {
    match: ['admin', 'owner', 'administrator'],
    permissions: [fullAccessPermissionKey, 'clinic_profile:view', 'clinic_profile:update', 'branches:view', 'staff:view', 'appointments:view', 'reports:view', 'leave:create', 'leave:review', 'inventory:review', 'inbox:view', 'orders:view', 'subscription:view', 'backup:view', 'profile:view', 'password:update', 'activities:view', 'notifications:view', 'support:view'],
  },
]

const chunkArray = (items, size = 10) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const normalizeRole = (docId, data, memberCount = 0) => ({
  id: docId,
  name: String(data.name || '').trim(),
  description: String(data.description || '').trim(),
  color: String(data.color || colorPresets[0]).trim() || colorPresets[0],
  permissions: Array.isArray(data.permissions) ? data.permissions.filter(Boolean) : [],
  ownerId: String(data.ownerId || '').trim(),
  memberCount,
})

const createBlankRole = () => ({
  name: '',
  description: '',
  color: colorPresets[0],
})

export default {
  name: 'OwnerRoleManagement',
  components: { OwnerSidebar, Icon },
  setup() {
    const { hasFeature, initSubscription } = useSubscription()
    const loading = ref(true)
    const saving = ref(false)
    const activeTab = ref('roles')
    const roles = ref([])
    const selectedRoleId = ref('')
    const selectedRoleDraft = ref({
      name: '',
      description: '',
      color: colorPresets[0],
      permissions: [],
    })
    const newRole = ref(createBlankRole())
    const branchIds = ref([])

    const selectedRole = computed(() =>
      roles.value.find((role) => role.id === selectedRoleId.value) || null
    )

    const tabs = computed(() => [
      { key: 'roles', label: 'Created Roles', icon: 'mdi:shield-outline', disabled: false },
      { key: 'add', label: 'Add Role', icon: 'mdi:plus-circle-outline', disabled: false },
      { key: 'details', label: 'Role Details', icon: 'mdi:form-textbox', disabled: !selectedRole.value },
      { key: 'permissions', label: 'Permissions', icon: 'mdi:shield-key-outline', disabled: !selectedRole.value },
    ])

    const totalAssignedMembers = computed(() =>
      roles.value.reduce((sum, role) => sum + Number(role.memberCount || 0), 0)
    )

    const selectedPermissionsCount = computed(() =>
      Array.isArray(selectedRoleDraft.value.permissions) ? selectedRoleDraft.value.permissions.length : 0
    )

    const statsCards = computed(() => [
      { label: 'Saved Roles', value: roles.value.length, description: 'Clinic-specific roles currently configured.' },
      { label: 'Assigned Staff', value: totalAssignedMembers.value, description: 'Staff linked to saved custom roles.' },
      { label: 'Branches Covered', value: branchIds.value.length, description: 'Branches under this clinic admin account.' },
    ])

    const permissionFeatureMap = {
      'staff:view': 'staff_management',
      'staff:create': 'staff_management',
      'staff:update': 'staff_management',
      'attendance:view': 'attendance',
      'attendance:create': 'attendance',
      'branches:view': 'multi_branch',
      'branches:create': 'multi_branch',
      'appointments:view': 'appointments',
      'appointments:create': 'appointments',
      'appointments:review': 'appointments',
      'clients:view': 'appointments',
      'clients:create': 'appointments',
      'consultations:view': 'online_consultations',
      'payments:view': 'reports',
      'payments:create': 'pos_payments',
      'reports:view': 'reports',
      'inventory:view': 'inventory',
      'inventory:create': 'inventory',
      'inventory:review': 'inventory',
      'orders:view': '',
      'services:view': 'services',
      'clinic_profile:view': '',
      'clinic_profile:update': '',
      'subscription:view': '',
      'backup:view': '',
      'profile:view': '',
      'password:update': '',
      'activities:view': '',
      'notifications:view': '',
      'support:view': '',
      'hr:view': 'hr',
      'hr:create': 'hr',
      'hr:update': 'hr',
      'leave:create': 'hr',
      'leave:review': 'hr',
      'inbox:view': '',
      'payroll:view': 'payroll',
      'payroll:update': 'payroll',
      [fullAccessPermissionKey]: '',
    }

    const isPermissionLocked = (permissionKey) => {
      const requiredFeature = permissionFeatureMap[permissionKey] || ''
      return Boolean(requiredFeature) && !hasFeature(requiredFeature)
    }

    const isDefaultPermission = (permissionKey) => defaultPermissionKeys.has(permissionKey)

    const isPermissionEnabled = (permissionKey) =>
      defaultPermissionKeys.has(permissionKey)
      || selectedRoleDraft.value.permissions.includes(permissionKey)
      || selectedRoleDraft.value.permissions.includes(fullAccessPermissionKey)

    const suggestedPermissions = computed(() => {
      const roleName = String(selectedRoleDraft.value.name || '').trim().toLowerCase()
      if (!roleName) return []

      const selectedPermissions = new Set(selectedRoleDraft.value.permissions || [])
      for (const rule of permissionSuggestionRules) {
        if (rule.match.some((token) => roleName.includes(token))) {
          return [...new Set(rule.permissions.filter((permission) => allPermissionKeys.includes(permission) && !selectedPermissions.has(permission)))]
        }
      }

      return [fullAccessPermissionKey, 'staff:view', 'appointments:view', 'appointments:review', 'leave:create', 'leave:review', 'inventory:review', 'orders:view', 'inbox:view', 'clients:view', 'subscription:view', 'backup:view', 'profile:view', 'password:update', 'activities:view', 'notifications:view', 'support:view']
        .filter((permission) => allPermissionKeys.includes(permission))
        .filter((permission) => !selectedPermissions.has(permission))
    })

    const permissionLabel = (permissionKey) => permissionLabelMap[permissionKey] || permissionKey

    const cloneSelectedRole = () => {
      if (!selectedRole.value) {
        selectedRoleDraft.value = {
          name: '',
          description: '',
          color: colorPresets[0],
          permissions: [],
        }
        return
      }

      selectedRoleDraft.value = {
        name: selectedRole.value.name,
        description: selectedRole.value.description,
        color: selectedRole.value.color,
        permissions: allPermissionKeys.filter(
          (key) => selectedRole.value.permissions.includes(key) || defaultPermissionKeys.has(key)
        ),
      }
    }

    const loadBranchIds = async (ownerId) => {
      const snapshot = await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', ownerId)))
      branchIds.value = snapshot.docs.map((branchDoc) => branchDoc.id).filter(Boolean)
    }

    const buildRoleCounts = async () => {
      const counts = new Map()

      if (!branchIds.value.length) return counts

      const chunks = chunkArray(branchIds.value, 10)
      for (const chunk of chunks) {
        const snapshot = await getDocs(query(collection(db, 'users'), where('branchId', 'in', chunk)))
        snapshot.forEach((userDoc) => {
          const data = userDoc.data() || {}
          const customRoleId = String(data.customRoleId || '').trim()
          if (!customRoleId) return
          counts.set(customRoleId, (counts.get(customRoleId) || 0) + 1)
        })
      }

      return counts
    }

    const loadRoles = async (ownerId = auth.currentUser?.uid) => {
      if (ownerId && typeof ownerId !== 'string') {
        ownerId = auth.currentUser?.uid
      }
      if (!ownerId) {
        loading.value = false
        roles.value = []
        branchIds.value = []
        selectedRoleId.value = ''
        return
      }

      loading.value = true
      try {
        await loadBranchIds(ownerId)
        const roleSnapshot = await getDocs(
          query(collection(db, 'clinicRoles'), where('ownerId', '==', ownerId))
        )
        const roleCounts = await buildRoleCounts()

        roles.value = roleSnapshot.docs
          .map((roleDoc) => normalizeRole(roleDoc.id, roleDoc.data() || {}, roleCounts.get(roleDoc.id) || 0))
          .sort((left, right) => left.name.localeCompare(right.name))

        if (!roles.value.length) {
          selectedRoleId.value = ''
          cloneSelectedRole()
          activeTab.value = 'roles'
          return
        }

        const stillExists = roles.value.some((role) => role.id === selectedRoleId.value)
        if (!stillExists) {
          selectedRoleId.value = roles.value[0].id
        }
        cloneSelectedRole()
      } catch (error) {
        console.error('Failed to load clinic roles:', error)
        toast.error('Unable to load role management data right now.')
      } finally {
        loading.value = false
      }
    }

    const openAddTab = () => {
      resetNewRole()
      activeTab.value = 'add'
    }

    const resetNewRole = () => {
      newRole.value = createBlankRole()
    }

    const selectRole = (roleId) => {
      selectedRoleId.value = roleId
      cloneSelectedRole()
      activeTab.value = 'roles'
    }

    const openDetails = (roleId) => {
      selectedRoleId.value = roleId
      cloneSelectedRole()
      activeTab.value = 'details'
    }

    const openPermissions = (roleId) => {
      selectedRoleId.value = roleId
      cloneSelectedRole()
      activeTab.value = 'permissions'
    }

    const createRole = async () => {
      const currentUser = auth.currentUser
      if (!currentUser) {
        toast.error('You need to be logged in to create roles.')
        return
      }

      if (!newRole.value.name.trim()) {
        toast.error('Role name is required.')
        return
      }

      saving.value = true
      try {
        const roleRef = doc(collection(db, 'clinicRoles'))
        await setDoc(roleRef, {
          ownerId: currentUser.uid,
          name: newRole.value.name.trim(),
          description: newRole.value.description.trim(),
          color: newRole.value.color,
          permissions: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        toast.success('Role created successfully.')
        resetNewRole()
        await loadRoles()
        selectedRoleId.value = roleRef.id
        cloneSelectedRole()
        activeTab.value = 'details'
      } catch (error) {
        console.error('Failed to create role:', error)
        toast.error('Unable to create this role right now.')
      } finally {
        saving.value = false
      }
    }

    const resetSelectedDraft = () => {
      cloneSelectedRole()
    }

    const saveRoleDetails = async () => {
      if (!selectedRole.value) return
      if (!selectedRoleDraft.value.name.trim()) {
        toast.error('Role name is required.')
        return
      }

      saving.value = true
      try {
        const trimmedRoleName = selectedRoleDraft.value.name.trim()
        await updateDoc(doc(db, 'clinicRoles', selectedRole.value.id), {
          name: trimmedRoleName,
          description: selectedRoleDraft.value.description.trim(),
          color: selectedRoleDraft.value.color,
          updatedAt: serverTimestamp(),
        })

        if (branchIds.value.length) {
          const branchChunks = chunkArray(branchIds.value, 10)
          for (const chunk of branchChunks) {
            const assignedUsersSnapshot = await getDocs(
              query(
                collection(db, 'users'),
                where('branchId', 'in', chunk),
                where('customRoleId', '==', selectedRole.value.id)
              )
            )

            if (assignedUsersSnapshot.empty) continue

            const batch = writeBatch(db)
            assignedUsersSnapshot.forEach((userDoc) => {
              batch.update(userDoc.ref, {
                customRoleName: trimmedRoleName
              })
            })
            await batch.commit()
          }
        }

        toast.success('Role details saved.')
        await loadRoles()
        activeTab.value = 'details'
      } catch (error) {
        console.error('Failed to save role details:', error)
        toast.error('Unable to save role details right now.')
      } finally {
        saving.value = false
      }
    }

    const togglePermission = (permissionKey) => {
      if (isDefaultPermission(permissionKey)) return
      if (isPermissionLocked(permissionKey)) return
      const permissions = new Set(selectedRoleDraft.value.permissions || [])
      if (permissionKey === fullAccessPermissionKey) {
        if (permissions.has(fullAccessPermissionKey)) {
          permissions.delete(fullAccessPermissionKey)
        } else {
          permissions.clear()
          permissions.add(fullAccessPermissionKey)
        }
        selectedRoleDraft.value.permissions = allPermissionKeys.filter((key) => permissions.has(key))
        return
      }
      if (permissions.has(fullAccessPermissionKey)) {
        permissions.delete(fullAccessPermissionKey)
      }
      if (permissions.has(permissionKey)) {
        permissions.delete(permissionKey)
      } else {
        permissions.add(permissionKey)
      }
      selectedRoleDraft.value.permissions = allPermissionKeys.filter((key) => permissions.has(key))
    }

    const saveRolePermissions = async () => {
      if (!selectedRole.value) return

      saving.value = true
      try {
        await updateDoc(doc(db, 'clinicRoles', selectedRole.value.id), {
          permissions: selectedRoleDraft.value.permissions.includes(fullAccessPermissionKey)
            ? [fullAccessPermissionKey]
            : [...selectedRoleDraft.value.permissions],
          updatedAt: serverTimestamp(),
        })
        toast.success('Role permissions saved.')
        await loadRoles()
        activeTab.value = 'permissions'
      } catch (error) {
        console.error('Failed to save role permissions:', error)
        toast.error('Unable to save role permissions right now.')
      } finally {
        saving.value = false
      }
    }

    const removeRole = async (roleId) => {
      const role = roles.value.find((entry) => entry.id === roleId)
      if (!role) return

      if (role.memberCount > 0) {
        toast.error('Remove or reassign staff from this role before deleting it.')
        return
      }

      const result = await Swal.fire({
        title: 'Delete Role',
        text: `Are you sure you want to delete the "${role.name}" role?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'Cancel',
      })

      if (!result.isConfirmed) return

      saving.value = true
      try {
        await deleteDoc(doc(db, 'clinicRoles', roleId))
        toast.success('Role deleted.')
        if (selectedRoleId.value === roleId) {
          selectedRoleId.value = ''
        }
        await loadRoles()
      } catch (error) {
        console.error('Failed to delete role:', error)
        toast.error('Unable to delete this role right now.')
      } finally {
        saving.value = false
      }
    }

    const enabledCountForGroup = (group) =>
      group.permissions.filter((permission) => selectedRoleDraft.value.permissions.includes(permission.key)).length

    let unsubscribeAuth = null

    onMounted(async () => {
      await initSubscription()
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          loading.value = false
          roles.value = []
          branchIds.value = []
          selectedRoleId.value = ''
          cloneSelectedRole()
          return
        }
        await loadRoles(user.uid)
      })
    })

    onUnmounted(() => {
      if (unsubscribeAuth) {
        unsubscribeAuth()
      }
    })

    return {
      activeTab,
      allPermissionKeys,
      branchIds,
      colorPresets,
      createRole,
      enabledCountForGroup,
      isPermissionLocked,
      isDefaultPermission,
      isPermissionEnabled,
      loadRoles,
      loading,
      newRole,
      openAddTab,
      openDetails,
      openPermissions,
      permissionGroups,
      removeRole,
      resetNewRole,
      resetSelectedDraft,
      roles,
      saveRoleDetails,
      saveRolePermissions,
      saving,
      selectRole,
      selectedPermissionsCount,
      selectedRole,
      selectedRoleDraft,
      selectedRoleId,
      permissionLabel,
      statsCards,
      suggestedPermissions,
      tabs,
      togglePermission,
      totalAssignedMembers,
    }
  },
}
</script>

<style scoped>
.tab-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
  border: 1px solid #1e293b;
  background: rgba(15, 23, 42, 0.86);
  color: #cbd5e1;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.tab-button:hover:not(:disabled) {
  border-color: #334155;
  background: rgba(30, 41, 59, 0.92);
}

.tab-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.tab-button-active {
  border-color: rgba(34, 211, 238, 0.38);
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.18), rgba(15, 23, 42, 0.96));
  color: #ecfeff;
}

.role-list-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 1rem;
  border: 1px solid transparent;
  background: rgba(15, 23, 42, 0.72);
  padding: 0.95rem 1rem;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.role-list-item:hover {
  border-color: rgba(56, 189, 248, 0.28);
  background: rgba(30, 41, 59, 0.92);
  transform: translateX(2px);
}

.role-list-item-active {
  border-color: rgba(34, 211, 238, 0.38);
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgba(15, 23, 42, 0.94));
}

.role-swatch {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 999px;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.9);
}

.role-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border-radius: 1.25rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 20px 40px rgba(15, 23, 42, 0.38);
}

.field-block {
  display: grid;
  gap: 0.6rem;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #94a3b8;
}

.discord-input {
  width: 100%;
  border-radius: 1rem;
  border: 1px solid #334155;
  background: rgba(15, 23, 42, 0.82);
  color: #f8fafc;
  padding: 0.95rem 1rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.discord-input:focus {
  border-color: #22d3ee;
  box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.14);
}

.discord-textarea {
  min-height: 7rem;
  resize: vertical;
}

.color-chip {
  height: 2.5rem;
  border-radius: 0.95rem;
  border: 2px solid transparent;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.color-chip:hover {
  transform: translateY(-1px);
}

.color-chip-active {
  border-color: #f8fafc;
}

.ghost-action,
.danger-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.95rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.ghost-action {
  border: 1px solid #334155;
  background: rgba(15, 23, 42, 0.78);
  color: #e2e8f0;
}

.ghost-action:hover {
  border-color: #22d3ee;
  color: #ecfeff;
}

.danger-action {
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(69, 10, 10, 0.55);
  color: #fecaca;
}

.danger-action:hover {
  background: rgba(127, 29, 29, 0.72);
}

.discord-switch {
  position: relative;
  display: inline-flex;
  width: 3.3rem;
  height: 1.85rem;
  border-radius: 999px;
  border: 1px solid #334155;
  background: #0f172a;
  transition: background 0.2s ease, border-color 0.2s ease;
  flex-shrink: 0;
}

.discord-switch-on {
  background: #22c55e;
  border-color: #22c55e;
}

.discord-switch-thumb {
  position: absolute;
  top: 0.18rem;
  left: 0.2rem;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  background: #fff;
  transition: transform 0.2s ease;
}

.discord-switch-on .discord-switch-thumb {
  transform: translateX(1.45rem);
}
</style>
