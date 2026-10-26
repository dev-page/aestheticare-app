<template>
  <div class="flex min-h-screen owner-theme bg-[#2a180f] text-[#f3e7e0]">
    <OwnerSidebar />

    <main v-page-loading="{ active: pageLoading, variant: 'split', rows: 5 }" class="flex-1 px-4 py-6 md:px-8 role-page-shell">
      <div class="mx-auto max-w-7xl space-y-6">
        <section class="rounded-[2rem] border border-[#5a3927] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.08),_transparent_42%),linear-gradient(180deg,_rgba(58,36,23,0.98),_rgba(42,24,15,0.98))] p-6 shadow-[0_24px_60px_rgba(20,12,8,0.45)]">
          <div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.28em] text-[#d2b7a6]">Clinic Administration</p>
              <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#f3e7e0]">Role Management</h1>
              <p class="mt-3 max-w-3xl text-sm leading-6 text-[#e2c7b6]">
                Start with protected built-in roles, customize their permissions, or create clinic-owned roles for your staff.
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-2xl border border-[#5a3927] bg-[#2a180f] px-4 py-2 text-sm font-medium text-[#f3e7e0] transition hover:border-[#8d5a3b] hover:bg-[#3a2417] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="loading"
                @click="loadRoles()"
              >
                <svg aria-hidden="true" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5m-5 2a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg>
                <span class="sr-only">Refresh</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-2xl bg-[#8d5a3b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6f4329]"
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
              class="rounded-2xl border border-[#5a3927] bg-[rgba(42,24,15,0.96)] p-4 shadow-sm"
            >
              <p class="text-xs uppercase tracking-[0.18em] text-[#d2b7a6]">{{ card.label }}</p>
              <div v-if="loading" class="mt-3 h-8 w-20 animate-pulse rounded-lg bg-[#5a3927]"></div>
              <p v-else class="mt-2 text-2xl font-semibold text-[#f3e7e0]">{{ card.value }}</p>
              <p class="mt-1 text-sm text-[#e2c7b6]">{{ card.description }}</p>
            </article>
          </div>
        </section>

        <section class="overflow-hidden rounded-[2rem] border border-[#5a3927] bg-[rgba(42,24,15,0.96)] shadow-[0_24px_60px_rgba(20,12,8,0.4)]">
          <div class="border-b border-[#5a3927] px-4 py-4 sm:px-6">
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
            <aside class="border-b border-[#5a3927] bg-[#24160f] xl:border-b-0 xl:border-r xl:border-[#5a3927]">
              <div class="border-b border-[#5a3927] px-5 py-4">
                <p class="text-xs uppercase tracking-[0.18em] text-[#d2b7a6]">Role Directory</p>
                <h2 class="mt-1 text-lg font-semibold text-[#f3e7e0]">Created Roles</h2>
                <p class="mt-1 text-sm text-[#e2c7b6]">Select a role to view details or update permissions.</p>
              </div>

              <div v-if="loading" class="space-y-3 p-4">
                <div v-for="item in 4" :key="item" class="h-20 animate-pulse rounded-2xl border border-[#5a3927] bg-[#3a2417]"></div>
              </div>

              <div v-else-if="!roles.length" class="p-5">
                <div class="rounded-2xl border border-dashed border-[#5a3927] bg-[#2a180f] px-4 py-8 text-center">
                  <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#5a3927] bg-[#3a2417] text-[#d2b7a6]">
                    <Icon icon="mdi:shield-outline" class="h-7 w-7" />
                  </div>
                  <h3 class="mt-4 text-base font-semibold text-[#f3e7e0]">No roles yet created</h3>
                  <p class="mt-2 text-sm leading-6 text-[#e2c7b6]">
                    Start by adding your first clinic role. It will appear here once saved.
                  </p>
                  <button
                    type="button"
                    class="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#8d5a3b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6f4329]"
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
                    <span class="role-swatch"></span>
                    <div class="min-w-0 text-left">
                      <p class="truncate text-sm font-semibold text-[#f3e7e0]">{{ role.name }}</p>
                      <p class="truncate text-xs text-[#d2b7a6]">{{ role.memberCount }} assigned staff</p>
                    </div>
                  </div>
                  <span
                    v-if="role.isBuiltIn"
                    class="shrink-0 whitespace-nowrap rounded-full border border-[#dfc5a8] bg-[#f6eadb] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#67452e]"
                  >
                    Built-in
                  </span>
                  <span
                    v-else-if="role.permissions.length === 0"
                    class="shrink-0 whitespace-nowrap rounded-full border border-[#dfc5a8] bg-[#f6eadb] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#67452e]"
                  >
                    Needs permissions
                  </span>
                  <Icon icon="mdi:chevron-right" class="h-5 w-5 flex-shrink-0 text-[#d2b7a6]" />
                </button>
              </div>
            </aside>

            <div class="min-h-0 min-w-0 overflow-y-auto bg-[#24160f]">
              <div v-if="loading" class="p-5 sm:p-6">
                <div class="space-y-5 rounded-[1.5rem] border border-[#5a3927] bg-[#2a180f] p-5">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div class="space-y-3">
                      <div class="h-4 w-28 animate-pulse rounded bg-[#5a3927]"></div>
                      <div class="h-7 w-56 animate-pulse rounded bg-[#5a3927]"></div>
                      <div class="h-4 w-80 max-w-full animate-pulse rounded bg-[#5a3927]"></div>
                    </div>
                    <div class="h-10 w-32 animate-pulse rounded-2xl bg-[#5a3927]"></div>
                  </div>

                  <div class="grid gap-4 lg:grid-cols-2">
                    <div
                      v-for="item in 4"
                      :key="`role-skeleton-${item}`"
                      class="rounded-2xl border border-[#5a3927] bg-[#3a2417] p-5"
                    >
                      <div class="flex items-start justify-between gap-4">
                        <div class="flex items-center gap-3">
                          <div class="h-4 w-4 animate-pulse rounded-full bg-[#5a3927]"></div>
                          <div class="space-y-2">
                            <div class="h-4 w-36 animate-pulse rounded bg-[#5a3927]"></div>
                            <div class="h-3 w-24 animate-pulse rounded bg-[#5a3927]"></div>
                          </div>
                        </div>
                        <div class="h-6 w-20 animate-pulse rounded-full bg-[#5a3927]"></div>
                      </div>
                      <div class="mt-4 h-4 w-full animate-pulse rounded bg-[#5a3927]"></div>
                      <div class="mt-2 h-4 w-4/5 animate-pulse rounded bg-[#5a3927]"></div>
                      <div class="mt-4 flex gap-2">
                        <div class="h-6 w-28 animate-pulse rounded-full bg-[#5a3927]"></div>
                        <div class="h-6 w-20 animate-pulse rounded-full bg-[#5a3927]"></div>
                      </div>
                      <div class="mt-5 flex gap-2">
                        <div class="h-10 w-28 animate-pulse rounded-2xl bg-[#5a3927]"></div>
                        <div class="h-10 w-32 animate-pulse rounded-2xl bg-[#5a3927]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="activeTab === 'roles'" class="p-5 sm:p-6">
                <div class="rounded-[1.5rem] border border-[#5a3927] bg-[#2a180f] p-5">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p class="text-xs uppercase tracking-[0.18em] text-[#d2b7a6]">Roles Overview</p>
                      <h3 class="mt-1 text-xl font-semibold text-[#f3e7e0]">Clinic Role Library</h3>
                <p class="mt-2 text-sm text-[#e2c7b6]">Built-in roles are ready to customize, and custom roles can be added for your clinic.</p>
                    </div>
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-2xl bg-[#8d5a3b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6f4329]"
                      @click="openAddTab"
                    >
                      <Icon icon="mdi:plus" class="h-4 w-4" />
                      Add New Role
                    </button>
                  </div>

                  <div v-if="!roles.length" class="mt-6 rounded-2xl border border-dashed border-[#5a3927] bg-[#24160f] px-5 py-12 text-center">
                    <Icon icon="mdi:shield-off-outline" class="mx-auto h-12 w-12 text-[#d2b7a6]" />
                    <h4 class="mt-4 text-lg font-semibold text-[#f3e7e0]">No roles yet created</h4>
                    <p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#e2c7b6]">
                      Your built-in roles will appear here after the clinic role library loads. Use the add tab for additional custom roles.
                    </p>
                  </div>

                  <div v-else class="mt-6 grid gap-4 lg:grid-cols-2">
                    <article
                      v-for="role in roles"
                      :key="`card-${role.id}`"
                      class="rounded-2xl border border-[#5a3927] bg-[#3a2417] p-5 transition hover:border-[#8d5a3b]"
                    >
                      <div class="flex items-start justify-between gap-4">
                        <div class="flex min-w-0 items-center gap-3">
                          <span class="role-swatch h-4 w-4"></span>
                          <div class="min-w-0">
                            <h4 class="truncate text-base font-semibold text-[#f3e7e0]">{{ role.name }}</h4>
                            <p class="mt-1 text-xs uppercase tracking-[0.16em] text-[#d2b7a6]">
                              {{ role.isBuiltIn ? 'Built-in Clinic Role' : 'Custom Clinic Role' }}
                            </p>
                          </div>
                        </div>
                        <span class="shrink-0 whitespace-nowrap rounded-full border border-[#ead8c4] bg-[#f4eadc] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#5c4533]">
                          {{ role.memberCount }} staff
                        </span>
                      </div>
                      <p class="mt-4 min-h-[3rem] text-sm leading-6 text-[#e2c7b6]">{{ role.description || 'No description added yet.' }}</p>
                      <div class="mt-4 flex flex-wrap gap-2">
                        <span class="rounded-full border border-[#ead8c4] bg-[#f4eadc] px-3 py-1 text-xs font-medium text-[#5c4533]">
                          {{ role.permissions.length }} permissions enabled
                        </span>
                      </div>
                      <div class="mt-5 flex flex-wrap gap-2">
                        <button type="button" class="ghost-action" @click="openDetails(role.id)">Role Details</button>
                        <button type="button" class="ghost-action" @click="openPermissions(role.id)">Set Permissions</button>
                        <button
                          v-if="!role.isBuiltIn"
                          type="button"
                          class="danger-action"
                          @click="removeRole(role.id)"
                        >
                          Delete
                        </button>
                        <span v-else class="rounded-2xl border border-[#5a3927] px-3 py-2 text-xs text-[#d2b7a6]">
                          Protected template
                        </span>
                      </div>
                    </article>
                  </div>
                </div>
              </div>

              <div v-else-if="activeTab === 'add'" class="p-5 sm:p-6">
                <div class="mx-auto max-w-3xl rounded-[1.5rem] border border-[#5a3927] bg-[#2a180f] p-5 sm:p-6">
                  <p class="text-xs uppercase tracking-[0.18em] text-[#d2b7a6]">New Role</p>
                  <h3 class="mt-1 text-xl font-semibold text-[#f3e7e0]">Add a Clinic Role</h3>
                  <p class="mt-2 text-sm text-[#e2c7b6]">
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

                    <div class="flex flex-wrap justify-end gap-3">
                      <button type="button" class="ghost-action" @click="resetNewRole">Reset</button>
                      <button
                        type="submit"
                        class="inline-flex items-center gap-2 rounded-2xl bg-[#8d5a3b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6f4329] disabled:cursor-not-allowed disabled:opacity-60"
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
                <div v-if="selectedRole" class="mx-auto max-w-4xl rounded-[1.5rem] border border-[#5a3927] bg-[#2a180f] p-5 sm:p-6">
                  <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div class="flex items-center gap-4">
                      <div class="role-badge">
                        <Icon icon="mdi:shield-account-outline" class="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p class="text-xs uppercase tracking-[0.18em] text-[#d2b7a6]">Role Details</p>
                        <h3 class="mt-1 text-xl font-semibold text-[#f3e7e0]">{{ selectedRoleDraft.name || 'Untitled Role' }}</h3>
                        <p class="mt-2 text-sm text-[#e2c7b6]">Update the role profile before assigning or managing permissions.</p>
                      </div>
                    </div>
                    <button
                      v-if="!selectedRole.isBuiltIn"
                      type="button"
                      class="danger-action"
                      @click="removeRole(selectedRole.id)"
                    >
                      Delete Role
                    </button>
                    <span v-else class="rounded-2xl border border-[#5a3927] px-3 py-2 text-xs text-[#d2b7a6]">
                      Protected built-in role
                    </span>
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
                          v-if="selectedRole.isBuiltIn"
                          type="button"
                          class="ghost-action"
                          :disabled="saving"
                          @click="resetBuiltInRole"
                        >
                          Reset to Default
                        </button>
                        <button
                          type="button"
                          class="inline-flex items-center gap-2 rounded-2xl bg-[#8d5a3b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6f4329] disabled:cursor-not-allowed disabled:opacity-60"
                          :disabled="saving"
                          @click="saveRoleDetails"
                        >
                          <Icon icon="mdi:content-save-outline" class="h-4 w-4" />
                          Save Details
                        </button>
                      </div>
                    </div>

                    <div class="space-y-5">
                      <div class="rounded-2xl border border-[#5a3927] bg-[#24160f] p-4">
                        <p class="field-label">Assigned Staff</p>
                        <p class="mt-2 text-2xl font-semibold text-[#f3e7e0]">{{ selectedRole.memberCount }}</p>
                        <p class="mt-1 text-sm text-[#e2c7b6]">Members currently linked to this custom role.</p>
                      </div>

                      <div class="rounded-2xl border border-[#5a3927] bg-[#24160f] p-4">
                        <p class="field-label text-[#d2b7a6]">Permission Status</p>
                        <p class="mt-2 text-sm text-[#e2c7b6]">
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
                            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#d2b7a6]">Suggested starting permissions</p>
                            <div class="flex flex-wrap gap-2">
                              <span
                                v-for="permission in suggestedPermissions"
                                :key="permission"
                                class="rounded-full border border-[#5a3927] bg-[#2a180f] px-3 py-1 text-xs text-[#e2c7b6]"
                              >
                                {{ permissionLabel(permission) }}
                              </span>
                            </div>
                          </div>
                          <p class="text-xs leading-5 text-[#e2c7b6]">
                            Tip: enable at least one permission before assigning this role to staff.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="activeTab === 'permissions'" class="p-5 sm:p-6">
                <div v-if="selectedRole" class="mx-auto max-w-5xl rounded-[1.5rem] border border-[#5a3927] bg-[#2a180f] p-5 sm:p-6">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="text-xs uppercase tracking-[0.18em] text-[#d2b7a6]">Permissions</p>
                      <h3 class="mt-1 text-xl font-semibold text-[#f3e7e0]">{{ selectedRoleDraft.name || selectedRole.name }}</h3>
                      <p class="mt-2 text-sm text-[#e2c7b6]">Turn access on or off, then save the permission set for this role.</p>
                    </div>
                    <span class="permission-count rounded-full border border-[#5a3927] bg-[#24160f] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#d2b7a6]">
                      {{ selectedPermissionsCount }}/{{ allPermissionKeys.length }} enabled
                    </span>
                  </div>

                  <div class="mt-5 rounded-2xl border border-[#8d5a3b]/60 bg-[#3a2417] p-4">
                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#d2b7a6]">Access Preview</p>
                        <p class="mt-1 text-sm text-[#e2c7b6]">This is the module access and page visibility this role will receive.</p>
                      </div>
                      <span class="text-xs font-semibold text-[#f3e7e0]">{{ accessPreview.length }} modules visible</span>
                    </div>
                    <div v-if="accessPreview.length" class="mt-3 flex flex-wrap gap-2">
                      <span
                        v-for="group in accessPreview"
                        :key="`preview-${group.key}`"
                        class="permission-chip rounded-full border border-[#8d5a3b] bg-[#24160f] px-3 py-1 text-xs text-[#f3e7e0]"
                      >
                        {{ group.label }} ({{ group.enabledCount }})
                      </span>
                    </div>
                    <p v-else class="mt-3 text-xs text-[#d2b7a6]">No modules will be visible until at least one permission is enabled.</p>
                  </div>

                  <div class="mt-6 space-y-5">
                    <div
                      v-if="selectedRoleDraft.permissions.length === 0"
                      class="rounded-2xl border border-[#5a3927] bg-[#24160f] p-4"
                    >
                      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#d2b7a6]">Permission Status</p>
                          <p class="mt-2 text-sm leading-6 text-[#e2c7b6]">
                            This role has no permissions yet, so it will not appear in the staff assignment dropdown until at least one permission is saved.
                          </p>
                        </div>
                        <span class="rounded-full border border-[#5a3927] bg-[#3a2417] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#d2b7a6]">
                          Action needed
                        </span>
                      </div>
                      <div v-if="suggestedPermissions.length" class="mt-4">
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#d2b7a6]">Suggested permissions</p>
                        <div class="mt-3 flex flex-wrap gap-2">
                          <span
                            v-for="permission in suggestedPermissions"
                            :key="permission"
                            class="rounded-full border border-[#5a3927] bg-[#2a180f] px-3 py-1 text-xs text-[#e2c7b6]"
                          >
                            {{ permissionLabel(permission) }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <article
                      v-for="group in permissionGroups"
                      :key="group.key"
                      class="overflow-hidden rounded-2xl border border-[#5a3927] bg-[#24160f]"
                    >
                      <div class="border-b border-[#5a3927] px-4 py-4">
                        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h4 class="text-sm font-semibold text-[#f3e7e0]">{{ group.label }}</h4>
                            <p class="text-xs text-[#d2b7a6]">{{ group.description }}</p>
                          </div>
                          <span class="rounded-full bg-[#3a2417] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#d2b7a6]">
                            {{ enabledCountForGroup(group) }}/{{ countPermissionsInGroup(group) }} enabled
                          </span>
                        </div>
                      </div>

                      <div class="space-y-4 p-4">
                        <section
                          v-for="section in group.sections"
                          :key="section.key"
                          class="overflow-hidden rounded-2xl border border-[#5a3927] bg-[#2a180f]"
                        >
                          <div class="border-b border-[#5a3927] px-4 py-3">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p class="text-sm font-semibold text-[#f3e7e0]">{{ section.label }}</p>
                                <p class="text-xs text-[#d2b7a6]">{{ section.description }}</p>
                              </div>
                              <span class="rounded-full bg-[#3a2417] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#d2b7a6]">
                                {{ enabledCountForSection(section) }}/{{ section.permissions.length }} enabled
                              </span>
                            </div>
                          </div>

                          <div class="divide-y divide-[#5a3927]">
                            <div
                              v-for="permission in section.permissions"
                              :key="permission.key"
                          class="permission-row flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div class="flex min-w-0 items-start gap-3">
                                <span class="permission-icon mt-0.5 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#5a3927] bg-[#3a2417] text-[#d2b7a6]">
                                  <Icon :icon="permission.icon" class="h-5 w-5" />
                                </span>
                                <div class="min-w-0">
                                  <p class="text-sm font-medium text-[#f3e7e0]">{{ permission.label }}</p>
                                  <p class="text-xs leading-5 text-[#e2c7b6]">{{ permission.description }}</p>
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
                                  class="text-right text-[11px] uppercase tracking-[0.18em] text-[#d2b7a6]"
                                >
                                  Default access
                                </div>
                                <div
                                  v-else-if="isPermissionLocked(permission.key)"
                                  class="text-right text-[11px] uppercase tracking-[0.18em] text-[#d2b7a6]"
                                >
                                  {{ isOwnerOnlyPermission(permission.key) ? 'System administrator only' : 'Locked by current plan' }}
                                </div>
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>
                    </article>
                  </div>

                  <div class="mt-6 flex flex-wrap justify-end gap-3">
                    <button type="button" class="ghost-action" @click="resetSelectedDraft">Discard Changes</button>
                    <button
                      v-if="selectedRole.isBuiltIn"
                      type="button"
                      class="ghost-action"
                      :disabled="saving"
                      @click="resetBuiltInRole"
                    >
                      Reset to Default
                    </button>
                    <button
                      type="button"
                      class="inline-flex items-center gap-2 rounded-2xl bg-[#8d5a3b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6f4329] disabled:cursor-not-allowed disabled:opacity-60"
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
import { usePageLoading } from '@/composables/usePageLoading'

import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import {
  allPermissionKeys,
  fullAccessPermissionKey,
  permissionDependencies,
  permissionFeatureMap,
  permissionGroups,
  permissionLabelMap,
} from '@/config/clinicPermissionRegistry'

const ROLE_COLOR = '#d2a679'
// These pages are always available to clinic staff as self-service. Request
// permissions do not grant access to review other employees' submissions.
const defaultPermissionKeys = new Set(['activities:view', 'notifications:view', 'leave:create', 'overtime:create'])
const ownerOnlyPermissionKeys = new Set(
  permissionGroups.flatMap((group) => group.sections.flatMap((section) =>
    section.permissions.filter((permission) => permission.ownerOnly).map((permission) => permission.key)
  ))
)

const permissionSuggestionRules = [
  {
    match: ['reception', 'front desk', 'frontdesk', 'receptionist', 'desk'],
    permissions: ['clients:view', 'clients:create', 'appointments:view', 'appointments:create', 'appointments:review', 'payments:view', 'payments:create', 'inbox:view', 'leave:create', 'overtime:view', 'overtime:create', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['practitioner', 'doctor', 'dentist', 'nurse', 'therapist', 'clinician'],
    permissions: ['clients:view', 'appointments:view', 'appointments:update', 'appointments:review', 'consultations:view', 'consultations:create', 'leave:create', 'overtime:view', 'overtime:create', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['hr', 'human resources'],
    permissions: ['staff:view', 'staff:create', 'staff:update', 'staff:disable', 'attendance:view', 'attendance:create', 'attendance:update', 'attendance:import', 'hr:view', 'hr:create', 'hr:update', 'leave:create', 'leave:review', 'overtime:view', 'overtime:create', 'overtime:review', 'payroll:update', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['finance', 'accounting', 'cashier'],
    permissions: ['payments:view', 'reports:view', 'payroll:view', 'payroll:approve', 'finance:purchases:view', 'finance:payables:view', 'finance:payables:approve', 'finance:payables:settle', 'finance:refunds:view', 'finance:refunds:manage', 'finance:sales:view', 'finance:reports:view', 'leave:create', 'overtime:view', 'overtime:create', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['branch manager', 'manager', 'operations', 'supervisor'],
    permissions: ['staff:view', 'staff:update', 'staff:disable', 'appointments:view', 'appointments:review', 'inventory:view', 'inventory:update', 'inventory:disable', 'suppliers:create', 'suppliers:update', 'inventory:review', 'orders:view', 'orders:update', 'services:view', 'services:create', 'services:update', 'services:disable', 'reports:view', 'leave:create', 'leave:review', 'overtime:view', 'overtime:create', 'overtime:review', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['inventory'],
    permissions: ['inventory:view', 'inventory:create', 'inventory:review', 'inventory:update', 'inventory:disable', 'suppliers:create', 'suppliers:update', 'orders:view', 'orders:update', 'reports:view', 'leave:create', 'overtime:view', 'overtime:create', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['procurement'],
    permissions: ['procurement:view', 'procurement:create', 'procurement:review', 'finance:purchases:view', 'orders:view', 'orders:update', 'suppliers:create', 'suppliers:update', 'reports:view', 'leave:create', 'overtime:view', 'overtime:create', 'notifications:view', 'profile:view', 'password:update'],
  },
  {
    match: ['pharmacist', 'pharmacy'],
    permissions: ['pharmacy:view', 'pharmacy:dispense', 'leave:create', 'overtime:view', 'overtime:create', 'notifications:view', 'profile:view', 'password:update'],
  },
]

const builtInRoleTemplates = [
  {
    key: 'clinic-manager',
    name: 'Branch Manager',
    description: 'Manages day-to-day operations for the branch where this employee is assigned.',
    color: ROLE_COLOR,
    suggestion: 'manager',
  },
  {
    key: 'receptionist',
    name: 'Receptionist',
    description: 'Handles walk-ins, customer booking requests, appointment records, payments, inbox messages, and notifications.',
    color: ROLE_COLOR,
    suggestion: 'reception',
  },
  {
    key: 'practitioner',
    name: 'Practitioner',
    description: 'Works with clients, appointments, consultations, and personal leave requests.',
    color: ROLE_COLOR,
    suggestion: 'practitioner',
  },
  {
    key: 'hr',
    name: 'HR',
    description: 'Manages employee records, attendance, leave, overtime, and payroll preparation.',
    color: ROLE_COLOR,
    suggestion: 'hr',
  },
  {
    key: 'finance',
    name: 'Finance',
    description: 'Reviews sales, purchases, payables, refunds, financial reports, and payroll approval.',
    color: ROLE_COLOR,
    suggestion: 'finance',
  },
  {
    key: 'inventory',
    name: 'Inventory',
    description: 'Maintains branch stock, item records, replenishment requests, and inventory movement.',
    color: ROLE_COLOR,
    suggestion: 'inventory',
  },
  {
    key: 'procurement',
    name: 'Procurement',
    description: 'Coordinates supplier quotes, purchase orders, deliveries, and procurement records.',
    color: ROLE_COLOR,
    suggestion: 'procurement',
  },
  {
    key: 'pharmacist',
    name: 'Pharmacist',
    description: 'Views pharmacy stock and prescription information, and processes permitted pharmacy sales.',
    color: ROLE_COLOR,
    suggestion: 'pharmacist',
  },
]

const getTemplatePermissions = (suggestion) => {
  const rule = permissionSuggestionRules.find((entry) => entry.match.includes(suggestion))
  if (!rule) return []
  return [...new Set(rule.permissions)]
}

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
  color: ROLE_COLOR,
  permissions: Array.isArray(data.permissions) ? data.permissions.filter(Boolean) : [],
  ownerId: String(data.ownerId || '').trim(),
  builtinKey: String(data.builtinKey || '').trim(),
  isBuiltIn: Boolean(data.isBuiltIn || data.builtinKey),
  memberCount,
})

const createBlankRole = () => ({
  name: '',
  description: '',
  color: ROLE_COLOR,
})

export default {
  name: 'OwnerRoleManagement',
  components: { OwnerSidebar, Icon },
  setup() {
const { pageLoading, trackPageLoad, pageListener } = usePageLoading()

    const { hasFeature, initSubscription } = useSubscription()
    const loading = ref(true)
    const saving = ref(false)
    const activeTab = ref('roles')
    const roles = ref([])
    const selectedRoleId = ref('')
    const selectedRoleDraft = ref({
      name: '',
      description: '',
      color: ROLE_COLOR,
      permissions: [],
    })
    const newRole = ref(createBlankRole())
    const branchIds = ref([])
    const accessScopeOwnerId = ref('')
    const accessScopeLabel = ref('')

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
      selectedRoleDraft.value.permissions.includes(fullAccessPermissionKey)
        ? allPermissionKeys.length
        : Array.isArray(selectedRoleDraft.value.permissions)
          ? selectedRoleDraft.value.permissions.length
          : 0
    )

    const statsCards = computed(() => [
      { label: 'Saved Roles', value: roles.value.length, description: 'Clinic-specific roles currently configured.' },
      { label: 'Assigned Staff', value: totalAssignedMembers.value, description: 'Staff linked to saved custom roles.' },
      { label: 'Branches Covered', value: branchIds.value.length, description: 'Branches under this clinic admin account.' },
    ])

    const isPermissionLocked = (permissionKey) => {
      const requiredFeature = permissionFeatureMap[permissionKey] || ''
      return isOwnerOnlyPermission(permissionKey)
        || (Boolean(requiredFeature) && !hasFeature(requiredFeature))
    }

    const isDefaultPermission = (permissionKey) => defaultPermissionKeys.has(permissionKey)

    const isOwnerOnlyPermission = (permissionKey) => ownerOnlyPermissionKeys.has(permissionKey)

    const isPermissionEnabled = (permissionKey) =>
      defaultPermissionKeys.has(permissionKey)
      || selectedRoleDraft.value.permissions.includes(permissionKey)
      || selectedRoleDraft.value.permissions.includes(fullAccessPermissionKey)

    const normalizePermissionSet = (permissionList = []) => {
      // Drop retired permissions from older role documents. This keeps the
      // editor, saved roles, and denormalized staff permissions aligned with
      // the features that are actually available now.
      const permissions = new Set(
        (Array.isArray(permissionList) ? permissionList : []).filter((permission) =>
          allPermissionKeys.includes(permission) || permission === fullAccessPermissionKey
        )
      )
      ownerOnlyPermissionKeys.forEach((permissionKey) => permissions.delete(permissionKey))
      // Full access is a platform-level capability; clinic custom roles can
      // never delegate it to a staff account.
      permissions.delete(fullAccessPermissionKey)

      const pending = [...permissions]
      while (pending.length) {
        const permissionKey = pending.pop()
        ;(permissionDependencies[permissionKey] || []).forEach((dependency) => {
          if (!permissions.has(dependency)) {
            permissions.add(dependency)
            pending.push(dependency)
          }
        })
      }
      return permissions
    }

    const removePermissionDependents = (permissions, removedPermission) => {
      permissions.delete(removedPermission)
      let changed = true
      while (changed) {
        changed = false
        Object.entries(permissionDependencies).forEach(([permissionKey, dependencies]) => {
          if (permissions.has(permissionKey) && dependencies.some((dependency) => !permissions.has(dependency))) {
            permissions.delete(permissionKey)
            changed = true
          }
        })
      }
    }

    const accessPreview = computed(() => permissionGroups
      .map((group) => {
        const enabledSections = group.sections
          .map((section) => ({
            ...section,
            enabledPermissions: section.permissions.filter((permission) => isPermissionEnabled(permission.key)),
          }))
          .filter((section) => section.enabledPermissions.length)
        return {
          ...group,
          enabledSections,
          enabledCount: enabledSections.reduce((total, section) => total + section.enabledPermissions.length, 0),
        }
      })
      .filter((group) => group.enabledCount > 0))

    const suggestedPermissions = computed(() => {
      const roleName = String(selectedRoleDraft.value.name || '').trim().toLowerCase()
      if (!roleName) return []

      const selectedPermissions = new Set(selectedRoleDraft.value.permissions || [])
      for (const rule of permissionSuggestionRules) {
        if (rule.match.some((token) => roleName.includes(token))) {
          return [...new Set(rule.permissions.filter((permission) => allPermissionKeys.includes(permission) && !selectedPermissions.has(permission)))]
        }
      }

      return ['staff:view', 'staff:create', 'staff:update', 'staff:disable', 'attendance:view', 'attendance:create', 'attendance:update', 'attendance:import', 'clients:view', 'clients:update', 'appointments:view', 'appointments:update', 'appointments:review', 'consultations:view', 'consultations:create', 'payments:view', 'inventory:view', 'inventory:create', 'inventory:update', 'inventory:disable', 'inventory:review', 'orders:view', 'orders:update', 'hr:view', 'hr:create', 'hr:update', 'leave:create', 'leave:review', 'payroll:view', 'payroll:update', 'services:view', 'services:create', 'services:update', 'services:disable', 'inbox:view', 'profile:view', 'password:update']
        .filter((permission) => allPermissionKeys.includes(permission))
        .filter((permission) => !selectedPermissions.has(permission))
    })

    const permissionLabel = (permissionKey) => permissionLabelMap[permissionKey] || permissionKey

    const cloneSelectedRole = () => {
      if (!selectedRole.value) {
        selectedRoleDraft.value = {
          name: '',
          description: '',
          color: ROLE_COLOR,
          permissions: [],
        }
        return
      }

      selectedRoleDraft.value = {
        name: selectedRole.value.name,
        description: selectedRole.value.description,
        color: ROLE_COLOR,
        permissions: allPermissionKeys.filter(
          (key) => normalizePermissionSet(selectedRole.value.permissions).has(key) || defaultPermissionKeys.has(key)
        ),
      }
    }

    const loadBranchIds = trackPageLoad(async (ownerId) => {
      const snapshot = await getDocs(query(collection(db, 'clinics'), where('ownerId', '==', ownerId)))
      branchIds.value = snapshot.docs.map((branchDoc) => branchDoc.id).filter(Boolean)
    })

    const resolveAccessScope = async (user) => {
      if (!user) {
        accessScopeOwnerId.value = ''
        accessScopeLabel.value = ''
        return ''
      }

      const userSnap = await getDoc(doc(db, 'users', user.uid))
      const userData = userSnap.exists() ? userSnap.data() || {} : {}
      const userType = String(userData.userType || '').trim().toLowerCase()

      if (userType === 'staff') {
        const branchId = String(userData.branchId || '').trim()
        if (branchId) {
          const clinicSnap = await getDoc(doc(db, 'clinics', branchId))
          if (clinicSnap.exists()) {
            const clinic = clinicSnap.data() || {}
            const ownerId = String(clinic.ownerId || '').trim() || user.uid
            accessScopeOwnerId.value = ownerId
            accessScopeLabel.value = [clinic.clinicBranch, clinic.clinicLocation].filter(Boolean).join(' - ') || 'Assigned clinic'
            return ownerId
          }
        }
      }

      accessScopeOwnerId.value = user.uid
      accessScopeLabel.value = userType === 'staff' ? 'Assigned clinic' : 'My clinic'
      return user.uid
    }

    const buildRoleCounts = async () => {
      const counts = new Map()

      if (!branchIds.value.length) return counts

      const chunks = chunkArray(branchIds.value, 10)
      for (const chunk of chunks) {
        const snapshot = await getDocs(query(collection(db, 'users'), where('branchId', 'in', chunk)))
        snapshot.forEach((userDoc) => {
          const data = userDoc.data() || {}
          const assignedRoleIds = Array.isArray(data.customRoleIds)
            ? data.customRoleIds
            : [data.customRoleId]
          ;[...new Set(assignedRoleIds.map((value) => String(value || '').trim()).filter(Boolean))].forEach((roleId) => {
            counts.set(roleId, (counts.get(roleId) || 0) + 1)
          })
        })
      }

      return counts
    }

    const removeOwnerFromStaffRoles = async (ownerId, roleSnapshot) => {
      if (auth.currentUser?.uid !== ownerId) return

      const staffRoleIds = new Set(
        roleSnapshot.docs
          .filter((roleDoc) => ['clinic-admin', 'clinic-owner'].includes(roleDoc.data()?.builtinKey))
          .map((roleDoc) => roleDoc.id)
      )
      if (!staffRoleIds.size) return

      const ownerRef = doc(db, 'users', ownerId)
      const ownerSnapshot = await getDoc(ownerRef)
      if (!ownerSnapshot.exists()) return

      const ownerData = ownerSnapshot.data() || {}
      const existingIds = [
        ...(Array.isArray(ownerData.customRoleIds) ? ownerData.customRoleIds : []),
        ownerData.customRoleId,
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
      const nextRoleIds = [...new Set(existingIds)].filter((roleId) => !staffRoleIds.has(roleId))
      const nextRoleNames = String(ownerData.customRoleName || '')
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name && name.toLowerCase() !== 'clinic admin' && name.toLowerCase() !== 'clinic owner')

      if (nextRoleIds.length === existingIds.length && nextRoleNames.join(', ') === String(ownerData.customRoleName || '').trim()) return

      await updateDoc(ownerRef, {
        customRoleId: nextRoleIds[0] || null,
        customRoleIds: nextRoleIds,
        customRoleName: nextRoleNames.join(', ') || null,
        updatedAt: serverTimestamp(),
      })
    }

    const removeClinicAdminRoles = async (ownerId, roleSnapshot) => {
      const deprecatedRoleKeys = new Set(['clinic-admin', 'clinic-owner'])
      const deprecatedRoles = roleSnapshot.docs.filter((roleDoc) => deprecatedRoleKeys.has(roleDoc.data()?.builtinKey))
      if (!deprecatedRoles.length) return roleSnapshot

      const removedRoleIds = new Set(deprecatedRoles.map((roleDoc) => roleDoc.id))
      const roleDataById = new Map(roleSnapshot.docs.map((roleDoc) => [roleDoc.id, roleDoc.data() || {}]))
      const assignedUsers = new Map()
      const ownerBranchIds = [...new Set([ownerId, ...branchIds.value].filter(Boolean))]

      for (const branchIdChunk of chunkArray(ownerBranchIds, 10)) {
        const snapshot = await getDocs(query(collection(db, 'users'), where('branchId', 'in', branchIdChunk)))
        snapshot.docs.forEach((userDoc) => assignedUsers.set(userDoc.id, userDoc))
      }
      const ownerSnapshot = await getDoc(doc(db, 'users', ownerId))
      if (ownerSnapshot.exists()) assignedUsers.set(ownerSnapshot.id, ownerSnapshot)

      let batch = writeBatch(db)
      let batchSize = 0
      const commits = []
      assignedUsers.forEach((userDoc) => {
        const userData = userDoc.data() || {}
        const assignedRoleIds = [...new Set([
          ...(Array.isArray(userData.customRoleIds) ? userData.customRoleIds : []),
          userData.customRoleId,
        ].map((value) => String(value || '').trim()).filter(Boolean))]
        if (!assignedRoleIds.some((roleId) => removedRoleIds.has(roleId))) return

        const remainingRoleIds = assignedRoleIds.filter((roleId) => !removedRoleIds.has(roleId))
        const remainingPermissions = [
          ...(Array.isArray(userData.permissions) ? userData.permissions : []),
          ...remainingRoleIds.flatMap((roleId) => Array.isArray(roleDataById.get(roleId)?.permissions)
            ? roleDataById.get(roleId).permissions
            : []),
        ]
        const existingRoleNames = String(userData.customRoleName || '').split(',').map((name) => name.trim()).filter(Boolean)
        const remainingRoleNames = remainingRoleIds
          .map((roleId) => String(roleDataById.get(roleId)?.name || '').trim())
          .filter(Boolean)
        const customRoleName = [...new Set(remainingRoleNames.length
          ? remainingRoleNames
          : existingRoleNames.filter((name) => !['clinic admin', 'clinic owner'].includes(name.toLowerCase())))].join(', ')

        batch.update(userDoc.ref, {
          customRoleId: remainingRoleIds[0] || null,
          customRoleIds: remainingRoleIds,
          customRoleName: customRoleName || null,
          effectivePermissions: [...normalizePermissionSet(remainingPermissions)],
          updatedAt: serverTimestamp(),
        })
        batchSize += 1
        if (batchSize >= 450) {
          commits.push(batch.commit())
          batch = writeBatch(db)
          batchSize = 0
        }
      })
      if (batchSize) commits.push(batch.commit())
      if (commits.length) await Promise.all(commits)

      await Promise.all(deprecatedRoles.map((roleDoc) => deleteDoc(roleDoc.ref)))
      return getDocs(query(collection(db, 'clinicRoles'), where('ownerId', '==', ownerId)))
    }

    const splitLegacyInventoryProcurementRole = async (ownerId, roleSnapshot) => {
      const legacyRoles = roleSnapshot.docs.filter((roleDoc) => roleDoc.data()?.builtinKey === 'inventory-procurement')
      if (!legacyRoles.length) return roleSnapshot

      const inventoryRole = roleSnapshot.docs.find((roleDoc) => roleDoc.data()?.builtinKey === 'inventory')
      const procurementRole = roleSnapshot.docs.find((roleDoc) => roleDoc.data()?.builtinKey === 'procurement')
      if (!inventoryRole || !procurementRole) return roleSnapshot

      const removedIds = new Set(legacyRoles.map((roleDoc) => roleDoc.id))
      const roleDataById = new Map(roleSnapshot.docs.map((roleDoc) => [roleDoc.id, roleDoc.data() || {}]))
      const replacementIds = [inventoryRole.id, procurementRole.id]
      const assignedUsers = new Map()
      for (const branchIdChunk of chunkArray([...new Set([ownerId, ...branchIds.value].filter(Boolean))], 10)) {
        const snapshot = await getDocs(query(collection(db, 'users'), where('branchId', 'in', branchIdChunk)))
        snapshot.docs.forEach((userDoc) => assignedUsers.set(userDoc.id, userDoc))
      }
      const ownerSnapshot = await getDoc(doc(db, 'users', ownerId))
      if (ownerSnapshot.exists()) assignedUsers.set(ownerSnapshot.id, ownerSnapshot)

      let batch = writeBatch(db)
      let batchSize = 0
      const commits = []
      assignedUsers.forEach((userDoc) => {
        const userData = userDoc.data() || {}
        const assignedRoleIds = [...new Set([
          ...(Array.isArray(userData.customRoleIds) ? userData.customRoleIds : []),
          userData.customRoleId,
        ].map((value) => String(value || '').trim()).filter(Boolean))]
        if (!assignedRoleIds.some((roleId) => removedIds.has(roleId))) return

        const nextRoleIds = [...new Set([
          ...assignedRoleIds.filter((roleId) => !removedIds.has(roleId)),
          ...replacementIds,
        ])]
        const nextPermissions = [
          ...(Array.isArray(userData.permissions) ? userData.permissions : []),
          ...nextRoleIds.flatMap((roleId) => Array.isArray(roleDataById.get(roleId)?.permissions)
            ? roleDataById.get(roleId).permissions
            : []),
        ]
        const roleNames = nextRoleIds.map((roleId) => String(roleDataById.get(roleId)?.name || '').trim()).filter(Boolean)
        batch.update(userDoc.ref, {
          customRoleId: nextRoleIds[0] || null,
          customRoleIds: nextRoleIds,
          customRoleName: [...new Set(roleNames)].join(', ') || null,
          effectivePermissions: [...normalizePermissionSet(nextPermissions)],
          updatedAt: serverTimestamp(),
        })
        batchSize += 1
        if (batchSize >= 450) {
          commits.push(batch.commit())
          batch = writeBatch(db)
          batchSize = 0
        }
      })
      if (batchSize) commits.push(batch.commit())
      if (commits.length) await Promise.all(commits)

      await Promise.all(legacyRoles.map((roleDoc) => deleteDoc(roleDoc.ref)))
      return getDocs(query(collection(db, 'clinicRoles'), where('ownerId', '==', ownerId)))
    }

    const loadRoles = trackPageLoad(async (ownerId = accessScopeOwnerId.value || auth.currentUser?.uid) => {
      if (ownerId && typeof ownerId !== 'string') {
        ownerId = accessScopeOwnerId.value || auth.currentUser?.uid
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
        let roleSnapshot = await getDocs(
          query(collection(db, 'clinicRoles'), where('ownerId', '==', ownerId))
        )

        roleSnapshot = await removeClinicAdminRoles(ownerId, roleSnapshot)

        const existingBuiltInKeys = new Set(
          roleSnapshot.docs
            .map((roleDoc) => String(roleDoc.data()?.builtinKey || '').trim())
            .filter(Boolean)
        )
        const missingTemplates = builtInRoleTemplates.filter(
          (template) => !existingBuiltInKeys.has(template.key)
        )

        if (missingTemplates.length) {
          await Promise.all(
            missingTemplates.map((template) => {
              const roleRef = doc(db, 'clinicRoles', `${ownerId}__builtin__${template.key}`)
              return setDoc(roleRef, {
                ownerId,
                name: template.name,
                description: template.description,
                color: ROLE_COLOR,
                builtinKey: template.key,
                isBuiltIn: true,
                permissions: getTemplatePermissions(template.suggestion),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }, { merge: false })
            })
          )
          roleSnapshot = await getDocs(
            query(collection(db, 'clinicRoles'), where('ownerId', '==', ownerId))
          )
        }

        roleSnapshot = await splitLegacyInventoryProcurementRole(ownerId, roleSnapshot)

        const managerTemplate = builtInRoleTemplates.find((template) => template.key === 'clinic-manager')
        const managerRoleDoc = roleSnapshot.docs.find((roleDoc) => roleDoc.data()?.builtinKey === 'clinic-manager')
        if (managerTemplate && managerRoleDoc) {
          const managerRoleData = managerRoleDoc.data() || {}
          if (managerRoleData.name !== managerTemplate.name || managerRoleData.description !== managerTemplate.description) {
            await updateDoc(managerRoleDoc.ref, {
              name: managerTemplate.name,
              description: managerTemplate.description,
              updatedAt: serverTimestamp(),
            })

            const [primaryAssignments, multiAssignments] = await Promise.all([
              getDocs(query(collection(db, 'users'), where('customRoleId', '==', managerRoleDoc.id))),
              getDocs(query(collection(db, 'users'), where('customRoleIds', 'array-contains', managerRoleDoc.id))),
            ])
            const assignedUsers = new Map()
            ;[...primaryAssignments.docs, ...multiAssignments.docs].forEach((userDoc) => assignedUsers.set(userDoc.id, userDoc))
            const commits = []
            let batch = writeBatch(db)
            let batchSize = 0
            assignedUsers.forEach((userDoc) => {
              const userData = userDoc.data() || {}
              const roleNames = String(userData.customRoleName || '').split(',').map((name) => {
                const trimmed = name.trim()
                return trimmed.toLowerCase() === 'manager' ? managerTemplate.name : trimmed
              }).filter(Boolean)
              const nextRoleName = [...new Set(roleNames)].join(', ')
              if (nextRoleName === String(userData.customRoleName || '').trim()) return
              batch.update(userDoc.ref, { customRoleName: nextRoleName, updatedAt: serverTimestamp() })
              batchSize += 1
              if (batchSize >= 450) {
                commits.push(batch.commit())
                batch = writeBatch(db)
                batchSize = 0
              }
            })
            if (batchSize) commits.push(batch.commit())
            if (commits.length) await Promise.all(commits)
            roleSnapshot = await getDocs(query(collection(db, 'clinicRoles'), where('ownerId', '==', ownerId)))
          }
        }

        await removeOwnerFromStaffRoles(ownerId, roleSnapshot)
        const roleCounts = await buildRoleCounts()

        roles.value = roleSnapshot.docs
          .map((roleDoc) => normalizeRole(roleDoc.id, roleDoc.data() || {}, roleCounts.get(roleDoc.id) || 0))
          .sort((left, right) => {
            if (left.isBuiltIn !== right.isBuiltIn) return left.isBuiltIn ? -1 : 1
            return left.name.localeCompare(right.name)
          })

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
    })

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
      activeTab.value = 'details'
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
        const ownerId = accessScopeOwnerId.value || currentUser.uid
        const roleRef = doc(collection(db, 'clinicRoles'))
        await setDoc(roleRef, {
          ownerId,
          name: newRole.value.name.trim(),
          description: newRole.value.description.trim(),
          color: ROLE_COLOR,
          permissions: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        toast.success('Role created successfully.')
        resetNewRole()
        await loadRoles(ownerId)
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
          color: ROLE_COLOR,
          updatedAt: serverTimestamp(),
        })

        if (branchIds.value.length) {
          const branchChunks = chunkArray(branchIds.value, 10)
          for (const chunk of branchChunks) {
            const [legacySnapshot, multiRoleSnapshot] = await Promise.all([
              getDocs(
                query(
                  collection(db, 'users'),
                  where('branchId', 'in', chunk),
                  where('customRoleId', '==', selectedRole.value.id)
                )
              ),
              getDocs(
                query(
                  collection(db, 'users'),
                  where('branchId', 'in', chunk),
                  where('customRoleIds', 'array-contains', selectedRole.value.id)
                )
              ),
            ])
            const assignedUsers = new Map()
            ;[...legacySnapshot.docs, ...multiRoleSnapshot.docs].forEach((userDoc) => {
              assignedUsers.set(userDoc.id, userDoc)
            })

            if (!assignedUsers.size) continue

            const batch = writeBatch(db)
            assignedUsers.forEach((userDoc) => {
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
        removePermissionDependents(permissions, permissionKey)
      } else {
        permissions.add(permissionKey)
        normalizePermissionSet([...permissions]).forEach((permission) => permissions.add(permission))
      }
      selectedRoleDraft.value.permissions = allPermissionKeys.filter((key) => permissions.has(key))
    }

    const saveRolePermissions = async () => {
      if (!selectedRole.value) return

      saving.value = true
      try {
        const normalizedPermissions = normalizePermissionSet(selectedRoleDraft.value.permissions)
        selectedRoleDraft.value.permissions = allPermissionKeys.filter((key) => normalizedPermissions.has(key))
        await updateDoc(doc(db, 'clinicRoles', selectedRole.value.id), {
          permissions: selectedRoleDraft.value.permissions.includes(fullAccessPermissionKey)
            ? [fullAccessPermissionKey]
            : [...selectedRoleDraft.value.permissions],
          updatedAt: serverTimestamp(),
        })

        // Keep a denormalized permission snapshot for Firestore rules and fast account loading.
        const rolePermissionMap = new Map(
          roles.value.map((role) => [role.id, Array.isArray(role.permissions) ? role.permissions : []])
        )
        rolePermissionMap.set(
          selectedRole.value.id,
          selectedRoleDraft.value.permissions.includes(fullAccessPermissionKey)
            ? [fullAccessPermissionKey]
            : [...selectedRoleDraft.value.permissions]
        )
        const branchChunks = chunkArray(branchIds.value, 10)
        for (const chunk of branchChunks) {
          const assignedUsersSnapshot = await getDocs(
            query(collection(db, 'users'), where('branchId', 'in', chunk))
          )
          let batch = writeBatch(db)
          let batchSize = 0
          const commits = []

          assignedUsersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data() || {}
            const assignedRoleIds = [
              ...(Array.isArray(userData.customRoleIds) ? userData.customRoleIds : []),
              userData.customRoleId,
            ]
              .map((value) => String(value || '').trim())
              .filter(Boolean)
              .filter((value, index, values) => values.indexOf(value) === index)
            if (!assignedRoleIds.includes(selectedRole.value.id)) return

            const permissions = new Set(Array.isArray(userData.permissions) ? userData.permissions : [])
            assignedRoleIds.forEach((roleId) => {
              ;(rolePermissionMap.get(roleId) || []).forEach((permission) => permissions.add(permission))
            })
            batch.update(userDoc.ref, { effectivePermissions: [...normalizePermissionSet([...permissions])] })
            batchSize += 1
            if (batchSize >= 450) {
              commits.push(batch.commit())
              batch = writeBatch(db)
              batchSize = 0
            }
          })

          if (batchSize > 0) commits.push(batch.commit())
          if (commits.length) await Promise.all(commits)
        }
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

    const resetBuiltInRole = async () => {
      const role = selectedRole.value
      if (!role?.isBuiltIn) return

      const template = builtInRoleTemplates.find((entry) => entry.key === role.builtinKey)
      if (!template) {
        toast.error('This built-in role template is no longer available.')
        return
      }

      const result = await Swal.fire({
        title: 'Reset built-in role?',
        text: 'This will replace the role details and permissions with the recommended defaults.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Reset role',
        cancelButtonText: 'Cancel',
      })

      if (!result.isConfirmed) return

      saving.value = true
      try {
        selectedRoleDraft.value = {
          name: template.name,
          description: template.description,
          color: ROLE_COLOR,
          permissions: allPermissionKeys.filter((permissionKey) =>
            normalizePermissionSet(getTemplatePermissions(template.suggestion)).has(permissionKey)
          ),
        }
        await updateDoc(doc(db, 'clinicRoles', role.id), {
          name: template.name,
          description: template.description,
          color: ROLE_COLOR,
          updatedAt: serverTimestamp(),
        })
        await saveRolePermissions()
        toast.success(`${template.name} reset to its recommended defaults.`)
      } catch (error) {
        console.error('Failed to reset built-in role:', error)
        toast.error('Unable to reset this built-in role right now.')
      } finally {
        saving.value = false
      }
    }

    const removeRole = async (roleId) => {
      const role = roles.value.find((entry) => entry.id === roleId)
      if (!role) return

      if (role.isBuiltIn) {
        toast.error('Built-in roles are protected. Use Reset to Default instead.')
        return
      }

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

    const countPermissionsInGroup = (group) =>
      group.sections.reduce((total, section) => total + section.permissions.length, 0)

    const enabledCountForGroup = (group) =>
      selectedRoleDraft.value.permissions.includes(fullAccessPermissionKey)
        ? countPermissionsInGroup(group)
        : group.sections.reduce(
          (total, section) =>
            total + section.permissions.filter((permission) => selectedRoleDraft.value.permissions.includes(permission.key)).length,
          0
        )

    const enabledCountForSection = (section) =>
      selectedRoleDraft.value.permissions.includes(fullAccessPermissionKey)
        ? section.permissions.length
        : section.permissions.filter((permission) => selectedRoleDraft.value.permissions.includes(permission.key)).length

    let unsubscribeAuth = null

    onMounted(trackPageLoad(async () => {
      await initSubscription()
      unsubscribeAuth = pageListener(onAuthStateChanged, auth, async (user) => {
        if (!user) {
          loading.value = false
          roles.value = []
          branchIds.value = []
          selectedRoleId.value = ''
          accessScopeOwnerId.value = ''
          accessScopeLabel.value = ''
          cloneSelectedRole()
          return
        }

        const ownerId = await resolveAccessScope(user)
        await loadRoles(ownerId)
      })
    }))

    onUnmounted(() => {
      if (unsubscribeAuth) {
        unsubscribeAuth()
      }
    })

    return {
      pageLoading,
      activeTab,
      allPermissionKeys,
      branchIds,
      createRole,
      countPermissionsInGroup,
      enabledCountForGroup,
      isPermissionLocked,
      isOwnerOnlyPermission,
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
      resetBuiltInRole,
      accessScopeLabel,
      accessPreview,
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
      enabledCountForSection,
    }
  },
}
</script>

<style scoped>
.role-page-shell {
  background:
    radial-gradient(circle at top left, rgba(230, 193, 150, .26), transparent 28%),
    radial-gradient(circle at 82% 8%, rgba(241, 213, 181, .38), transparent 22%),
    linear-gradient(180deg, var(--ac-bg) 0%, var(--ac-bg-soft) 52%, var(--ac-bg-deep) 100%);
}

.tab-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--ac-border);
  background: var(--ac-surface);
  color: var(--ac-text-secondary);
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.tab-button:hover:not(:disabled) {
  border-color: var(--ac-border-strong);
  background: var(--ac-surface-muted);
}

.tab-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.tab-button-active {
  border-color: var(--ac-primary);
  background: var(--ac-primary);
  color: var(--ac-on-primary);
}

.role-list-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 1rem;
  border: 1px solid var(--ac-border);
  background: var(--ac-surface);
  padding: 0.95rem 1rem;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.role-list-item:hover {
  border-color: var(--ac-border-strong);
  background: var(--ac-surface-soft);
  transform: translateX(2px);
}

.role-list-item-active {
  border-color: var(--ac-border-strong);
  background: linear-gradient(135deg, #f1d5b5, #fffaf3);
}

.role-swatch {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 999px;
  flex-shrink: 0;
  background: #d2a679;
  box-shadow: 0 0 0 3px var(--ac-surface-soft);
}

.role-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border-radius: 1.25rem;
  background: #d2a679;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 20px 40px rgba(87, 56, 35, 0.18);
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
  color: var(--ac-text-muted);
}

.discord-input {
  width: 100%;
  border-radius: 1rem;
  border: 1px solid var(--ac-border);
  background: var(--ac-surface);
  color: var(--ac-text);
  padding: 0.95rem 1rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.discord-input:focus {
  border-color: var(--ac-border-strong);
  box-shadow: 0 0 0 3px rgba(185, 121, 79, .16);
}

.discord-textarea {
  min-height: 7rem;
  resize: vertical;
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
  border: 1px solid var(--ac-border);
  background: var(--ac-surface);
  color: var(--ac-primary);
}

.ghost-action:hover {
  border-color: var(--ac-border-strong);
  background: var(--ac-surface-muted);
  color: var(--ac-primary);
}

.danger-action {
  border: 1px solid rgba(239, 68, 68, 0.28);
  background: rgba(127, 29, 29, 0.16);
  color: #fecaca;
}

.danger-action:hover {
  background: rgba(127, 29, 29, 0.24);
}

.discord-switch {
  position: relative;
  display: inline-flex;
  width: 3.3rem;
  height: 1.85rem;
  border-radius: 999px;
  border: 1px solid var(--ac-border);
  background: #f1e2cf;
  transition: background 0.2s ease, border-color 0.2s ease;
  flex-shrink: 0;
  cursor: pointer;
  box-shadow: none !important;
}

.discord-switch-on {
  background: #8d5a3b;
  border-color: #8d5a3b;
}

.discord-switch-thumb {
  position: absolute;
  top: 0.18rem;
  left: 0.2rem;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  background: #fffdf9;
  transition: transform 0.2s ease;
}

.discord-switch-on .discord-switch-thumb {
  transform: translateX(1.45rem);
}

/* The global owner theme lightens panel surfaces. Keep these controls in the
   same palette so their labels and states remain legible after that override. */
.permission-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: .35rem .75rem;
  border-color: var(--ac-border) !important;
  background: var(--ac-surface-soft) !important;
  color: var(--ac-text-secondary) !important;
  white-space: nowrap;
  font-size: .7rem;
  font-weight: 700;
  letter-spacing: .08em;
  line-height: 1.2;
}

.permission-chip {
  border-color: var(--ac-border) !important;
  background: var(--ac-surface-muted) !important;
  color: var(--ac-text-secondary) !important;
}

.permission-icon {
  border-color: var(--ac-border) !important;
  background: var(--ac-surface-muted) !important;
  color: var(--ac-primary) !important;
  box-shadow: none !important;
}

.permission-row {
  min-width: 0;
}

.discord-switch:focus-visible {
  outline: 3px solid rgba(141, 90, 59, .32);
  outline-offset: 2px;
}

.discord-switch:disabled {
  cursor: not-allowed;
  opacity: .58;
}

.discord-switch:disabled .discord-switch-thumb {
  background: #fffdf9;
}

@media (max-width: 640px) {
  .permission-row > :last-child {
    width: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
