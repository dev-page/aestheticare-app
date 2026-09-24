<template>
  <div class="supplier-theme flex min-h-screen">
    <SupplierSidebar />

    <main data-onboarding-key="supplier-catalog" class="supplier-catalog-page flex-1 p-6 md:p-8">
      <section class="mx-auto max-w-7xl space-y-6">
        <div class="rounded-[2rem] border border-[#e4c7a1] bg-white/85 p-6 shadow-[0_18px_44px_rgba(77,52,31,0.08)] backdrop-blur">
          <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6848]">Supplier Supplies</p>
              <h1 class="mt-2 text-3xl font-bold text-[#40261a]">Manage your item catalog</h1>
              <p class="mt-2 max-w-3xl text-sm leading-6 text-[#6f503d]">
                Add the products, equipment, and medical supplies that your business offers. Package or measurement details are optional and only needed when they help identify the supply.
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-xl bg-[#8d5a3b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6f4329]" :disabled="loading || saving || checkingImage" @click="addItemRow">
                Add Item
              </button>
              <button type="button" data-onboarding-key="supplier-catalog-save" class="rounded-xl border border-[#d9b38d] bg-[#fff8ef] px-4 py-2 text-sm font-semibold text-[#6f4329] transition hover:bg-[#f7ead8]" :disabled="loading || saving || checkingImage" @click="saveSupplies">
                Save Supplies
              </button>
            </div>
          </div>

          <div class="mt-5 grid gap-4 md:grid-cols-3">
            <article class="rounded-2xl border border-[#ead1b0] bg-[#fffaf4] p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6848]">Items</p>
              <p class="mt-2 text-2xl font-bold text-[#40261a]">{{ activeItemCount }}</p>
            </article>
            <article class="rounded-2xl border border-[#ead1b0] bg-[#fffaf4] p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6848]">Categories</p>
              <p class="mt-2 text-2xl font-bold text-[#40261a]">{{ categoryCount }}</p>
            </article>
            <article class="rounded-2xl border border-[#ead1b0] bg-[#fffaf4] p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6848]">Profile Ready</p>
              <p class="mt-2 text-sm text-[#5a402f]">{{ businessName || 'Complete your supplier profile first.' }}</p>
            </article>
          </div>
        </div>

        <div v-if="loading" class="grid gap-4">
          <div v-for="index in 2" :key="index" class="h-56 rounded-[2rem] border border-[#e4c7a1] bg-white/70 animate-pulse"></div>
        </div>

        <section v-if="!loading" class="overflow-hidden rounded-[2rem] border border-[#e4c7a1] bg-white/90 shadow-sm">
          <div class="border-b border-[#ecd9c0] px-5 py-4">
            <h2 class="text-xl font-bold text-[#40261a]" data-onboarding-key="supplier-saved-catalog">Saved Supplies</h2>
            <p class="mt-1 text-sm text-[#6f503d]">{{ savedCatalog.length }} saved items · 5 items per page</p>
          </div>
          <p v-if="!savedCatalog.length" class="p-5 text-sm text-[#6f503d]">No saved items yet. Add your first item using the form below.</p>
          <template v-else>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[640px] text-left text-sm">
                <thead class="bg-[#fff5e8] text-[#806047]">
                  <tr><th scope="col" class="px-5 py-3">Item</th><th scope="col" class="px-5 py-3">Category</th><th scope="col" class="px-5 py-3">Stock</th><th scope="col" class="px-5 py-3">Price</th><th scope="col" class="px-5 py-3">Action</th></tr>
                </thead>
                <tbody class="divide-y divide-[#efdfca] text-[#5a402f]">
                  <tr v-for="item in paginatedItems" :key="item.id">
                    <td class="px-5 py-4 font-semibold">{{ item.name }}</td>
                    <td class="px-5 py-4">{{ item.category === 'Others' ? item.customCategory : item.category }}</td>
                    <td class="px-5 py-4"><span class="font-semibold">{{ availableQuantity(item) }}</span> available <span class="text-xs text-[#806047]">of {{ item.quantity }} on hand</span></td>
                    <td class="px-5 py-4 whitespace-nowrap">{{ formatMoney(item.price ?? item.unitCost) }}</td>
                    <td class="px-5 py-4"><div class="flex gap-2"><button type="button" class="catalog-button" :aria-label="`View details for ${item.name}`" @click="selectedItem = item">View</button><button type="button" class="catalog-button" :aria-label="`Edit ${item.name}`" @click="editCatalogItem(item)">Edit</button></div></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <nav aria-label="Saved supplies pagination" class="flex flex-wrap items-center justify-between gap-3 border-t border-[#ecd9c0] px-5 py-4">
              <p class="text-sm text-[#6f503d]" aria-live="polite">Page {{ currentPage }} of {{ totalPages }}</p>
              <div class="flex gap-2">
                <button type="button" class="catalog-button" :disabled="currentPage === 1" @click="currentPage--">Previous</button>
                <button type="button" class="catalog-button" :disabled="currentPage === totalPages" @click="currentPage++">Next</button>
              </div>
            </nav>
          </template>
        </section>

        <form v-if="!loading" data-supplier-catalog-form class="exact-catalog-form" @click="handleCatalogClick" @submit.prevent="saveSupplies">
          <article v-for="(item, index) in items" :key="`exact-${item.id}`" class="exact-item-card">
            <header class="exact-item-header"><div><p>ITEM {{ index + 1 }}</p><h2>{{ item.name || 'Add New Item' }}</h2><span>Provide the item details, pricing, and tax information. Order-level charges (e.g., delivery, handling) will be added during procurement requests.</span></div><button type="button" @click="removeItemRow(index)">♜ <b>Remove</b></button></header>
            <div class="exact-item-content"><section class="exact-left"><div class="exact-image"><img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name || 'Item image'" /><template v-else><strong>▧＋</strong><b>No item image yet</b><span>Upload a clear photo of the product (PNG, JPG, WebP, or GIF, max 25 MB).</span></template><label>↥ &nbsp; Upload Item Photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" @change="handleItemImageChange(index, $event)" /></label></div><label>ITEM NAME <em>*</em><input v-model="item.name" placeholder="Enter item name (e.g., Disposable Gloves)" /></label><label>ITEM CATEGORY <em>*</em><select v-model="item.category"><option value="">Select category</option><option v-for="option in categoryOptions" :key="option" :value="option">{{ option }}</option></select></label><label v-if="item.category === 'Others'">CUSTOM CATEGORY<input v-model="item.customCategory" placeholder="Enter custom category" /></label><label>DESCRIPTION<textarea v-model="item.description" rows="5" placeholder="Describe the item, including key features, brand, or intended use."></textarea></label><div class="exact-pair"><label>UNIT OF MEASUREMENT <em>*</em><select v-model="item.measurementUnit"><option value="">Select unit (e.g., box, vial, pc)</option><option v-for="unit in measurementOptions" :key="unit" :value="unit">{{ unit }}</option></select></label><label>MINIMUM ORDER QUANTITY<input v-model.number="item.minOrderQuantity" type="number" min="0" placeholder="Optional" /></label></div></section><section class="exact-right"><label>QUANTITY (STOCK AVAILABLE)<input :value="item.quantity" inputmode="numeric" @beforeinput="blockInvalidNumberInput($event)" @input="item.quantity = readNumberInput($event, item.quantity)" placeholder="0" /></label><small>Current available quantity in your inventory (optional).</small><div class="exact-package"><b>▣ &nbsp; Package details (optional)</b><span>Record the amount contained in one selling unit. For example: enter “10” and select “mL” for a 10 mL vial, or enter “5” and select “pcs” for a box of 5 pieces.</span><button type="button" @click="item.showMeasurement = true">＋ Add Package Details</button><div v-if="item.showMeasurement" class="exact-pair"><input v-model="item.measurementValue" placeholder="e.g., 10" /><select v-model="item.measurementUnit"><option value="">Select unit</option><option v-for="unit in measurementOptions" :key="unit" :value="unit">{{ unit }}</option></select></div></div><label>SPECIFICATIONS / DETAILS<textarea v-model="item.specifications" rows="5" placeholder="Example: sterile, 10 mL per vial, 5 pcs per box, 2 kg equipment, 15x20 cm dimensions."></textarea></label><div class="exact-pair"><label>UNIT PRICE (PHP) <em>*</em><div class="exact-price"><b>₱</b><input :value="item.price" @beforeinput="blockInvalidNumberInput($event, true)" @input="item.price = readNumberInput($event, item.price, true)" @blur="formatPrice(item)" placeholder="0.00" /></div></label><label>TAX TREATMENT <em>*</em><select v-model="item.taxTreatment" @change="applyTaxTreatment(item)"><option value="vat-inclusive">12% VAT — price inclusive</option><option value="vat-exclusive">12% VAT — added to price</option><option value="zero-rated">Zero-rated VAT</option><option value="vat-exempt">VAT exempt</option></select></label></div><p class="exact-tax-note">ⓘ Select how VAT applies to this item. This will be used when the item is added to a procurement request.</p><div class="exact-pair"><label>ITEM DISCOUNT RATE (%)<input v-model.number="item.discountRate" type="number" min="0" max="100" placeholder="0" /></label><div><label>BULK DISCOUNT</label><button type="button" class="exact-tier">＋ Add Tiered Pricing (Optional)</button></div></div><aside>ⓘ <div><b>Order-level charges are not set here</b><span>Delivery fees, handling fees, and other charges will be added per procurement request, as they depend on the order destination and quantity.</span></div></aside></section></div>
            <div class="exact-pair px-5 pb-5"><label>OTHER CHARGE / UNIT (PHP)<div class="exact-price"><b>₱</b><input v-model.number="item.otherChargePerUnit" type="number" min="0" step="0.01" placeholder="0.00" /></div><small>Recurring handling, packaging, or regulatory charge per unit. It will prefill supplier quotations.</small></label><aside>ⓘ <div><b>Delivery remains order-specific</b><span>Catalog price, VAT, discount, and per-unit charges carry into the quote. Delivery is set for the actual destination.</span></div></aside></div>
            <section v-if="item.tieredDiscounts?.length" class="exact-fda"><h3>Bulk discount tiers</h3><div v-for="(tier, tierIndex) in item.tieredDiscounts" :key="tierIndex" class="exact-pair"><label>MINIMUM QUANTITY<input v-model.number="tier.minQuantity" type="number" min="2" step="1" /></label><label>DISCOUNT RATE (%)<input v-model.number="tier.discountRate" type="number" min="0" max="100" step="0.01" /><button type="button" class="exact-tier" @click="item.tieredDiscounts.splice(tierIndex, 1)">Remove tier</button></label></div></section>
            <section class="exact-fda"><h3>FDA Documentation <span>(optional)</span></h3><p>Upload supporting information when applicable. It is not required for every supply item.</p><div class="exact-pair"><label>FDA REGISTRATION NUMBER<input v-model.trim="item.fdaRegistrationNumber" maxlength="100" placeholder="Optional" /></label><label>FDA DOCUMENT<input v-if="!item.fdaApprovalDocument?.url && !item.fdaApprovalFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" @change="handleFdaDocumentChange(index, $event)" /><span v-else>{{ item.fdaApprovalFileName || item.fdaApprovalDocument?.name || 'Document attached' }}</span></label></div></section>
            <footer><button type="button" @click="items = [createEmptyItem()]">Cancel</button><button type="submit">Save Item</button></footer>
          </article>
        </form>
        <form v-if="false && !loading" data-supplier-catalog-form class="legacy-catalog-form space-y-5" @submit.prevent="saveSupplies">
          <fieldset :disabled="saving || checkingImage" class="min-w-0 space-y-5">
          <article
            v-for="(item, index) in items"
            :key="item.id"
            class="supplier-item-card overflow-hidden rounded-[2rem] border border-[#e4c7a1] bg-white/90 shadow-[0_12px_30px_rgba(77,52,31,0.06)]"
          >
            <div class="supplier-item-header flex flex-col gap-3 border-b border-[#ecd9c0] px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6848]">Item {{ index + 1 }}</p>
                <h2 class="mt-1 text-xl font-bold text-[#40261a]">{{ item.name || 'Add New Item' }}</h2>
                <p class="mt-1 text-sm text-[#7b5a43]">Provide item details, pricing, and tax information. Delivery and handling charges are added during Procurement requests.</p>
              </div>
              <button
                type="button"
                class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                @click="removeItemRow(index)"
              >
                Remove
              </button>
            </div>

            <div class="supplier-item-grid grid gap-5 px-5 py-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div class="supplier-item-details space-y-4">
                <div class="supplier-image-panel overflow-hidden rounded-2xl border border-dashed border-[#dfb98d] bg-[#fff8ef] p-4">
                  <div class="flex flex-col items-center gap-3">
                    <div class="flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-[#f7e9d8]">
                      <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name || 'Item image'" class="h-full w-full object-cover" />
                      <span v-else class="text-sm font-semibold text-[#9b7759]">No item image yet</span>
                    </div>
                    <label class="cursor-pointer rounded-xl border border-[#d8b289] bg-white px-4 py-2 text-sm font-semibold text-[#7b4a2f] transition hover:bg-[#f6eadc]">
                      Upload Item Photo
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" @change="handleItemImageChange(index, $event)" />
                    </label>
                    <p class="text-xs text-[#7b5a43]">One JPG, PNG, WebP, or GIF image per item, under 25 MB.</p>
                  </div>
                </div>

                <div>
                  <label class="item-label">Item Name</label>
                  <input v-model="item.name" maxlength="120" type="text" class="item-input" placeholder="Enter item name" />
                </div>

                <div>
                  <label class="item-label">Item Category</label>
                  <select v-model="item.category" class="item-input">
                    <option value="">Select category</option>
                    <option v-for="option in categoryOptions" :key="option" :value="option">{{ option }}</option>
                  </select>
                </div>

                <div v-if="item.category === 'Others'">
                  <label class="item-label">Custom Category</label>
                  <input v-model="item.customCategory" maxlength="80" type="text" class="item-input" placeholder="Enter custom category" />
                </div>

                <div>
                  <label class="item-label">Description</label>
                  <textarea v-model="item.description" maxlength="2000" rows="4" class="item-input item-textarea" placeholder="Describe the item"></textarea>
                </div>
              </div>

              <div class="supplier-item-pricing grid gap-4 md:grid-cols-2">
                <div>
                  <label class="item-label">Quantity (Stock Available)</label>
                  <input :value="item.quantity" type="text" inputmode="numeric" @beforeinput="blockInvalidNumberInput($event)" @input="item.quantity = readNumberInput($event, item.quantity)" class="item-input" placeholder="0" />
                </div>

                <template v-if="shouldShowMeasurement(item)">
                  <div>
                    <label class="item-label">Package / Measurement Value <span class="normal-case font-normal">(optional)</span></label>
                    <input v-model="item.measurementValue" maxlength="80" type="text" class="item-input" placeholder="e.g. 10, 500, 2x3" />
                  </div>

                  <div class="md:col-span-2">
                    <label class="item-label">Package / Measurement Unit <span class="normal-case font-normal">(optional)</span></label>
                    <select v-model="item.measurementUnit" class="item-input">
                      <option value="">Select unit</option>
                      <option v-for="unit in measurementOptions" :key="unit" :value="unit">{{ unit }}</option>
                    </select>
                  </div>
                </template>
                <div v-else class="md:col-span-2 rounded-xl border border-dashed border-[#dfb98d] bg-[#fff8ef] p-3">
                  <p class="text-sm text-[#6f503d]">Package, dosage, dimensions, or weight are optional for {{ item.category || 'this item' }}.</p>
                  <button type="button" class="mt-2 text-sm font-semibold text-[#7b4a2f] underline" @click="item.showMeasurement = true">Add optional measurement details</button>
                </div>

                <div class="md:col-span-2">
                  <label class="item-label">Specifications / Details</label>
                  <textarea
                    v-model="item.specifications" maxlength="2000"
                    rows="4"
                    class="item-input item-textarea"
                    placeholder="Example: sterile, 10 mL per vial, 5 pcs per box, 2 kg equipment, 15x20 cm dimensions"
                  ></textarea>
                  <p class="mt-2 text-xs leading-5 text-[#7b5a43]">
                    For skincare or injectables, you can use mL, mg, or g. For equipment, use set, unit, pair, box, dimensions, or weight. If none of the preset units fit, use "custom" and explain it here.
                  </p>
                </div>

                <template v-if="shouldShowShelfLife(item)">
                  <div>
                    <label class="item-label">Manufacturing Date <span class="normal-case font-normal">(if applicable)</span></label>
                    <input v-model="item.manufacturingDate" type="date" class="item-input" />
                  </div>
                  <div>
                    <label class="item-label">Expiry Date <span class="normal-case font-normal">(if applicable)</span></label>
                    <input v-model="item.expiryDate" type="date" class="item-input" :min="item.manufacturingDate || undefined" />
                  </div>
                </template>

                <div>
                  <label class="item-label">Unit Price (PHP)</label>
                  <div class="price-field">
                    <span class="price-prefix">PHP</span>
                    <input :value="item.price" @beforeinput="blockInvalidNumberInput($event, true)" @input="item.price = readNumberInput($event, item.price, true)" aria-label="Price in Philippine pesos" type="text" inputmode="decimal" maxlength="12" class="item-input price-input" placeholder="0.00" @blur="formatPrice(item)" />
                  </div>
                </div>

                <div>
                  <label class="item-label">Tax Treatment</label>
                  <select v-model="item.taxTreatment" class="item-input" @change="applyTaxTreatment(item)"><option value="vat-inclusive">12% VAT — price inclusive</option><option value="vat-exclusive">12% VAT — added to price</option><option value="zero-rated">Zero-rated VAT</option><option value="vat-exempt">VAT exempt</option></select>
                  <p class="mt-2 text-xs text-[#7b5a43]">This determines how tax is used in Procurement’s funding request.</p>
                </div>
                <div>
                  <label class="item-label">Default Discount Rate <span class="normal-case font-normal">(%)</span></label>
                  <input v-model.number="item.discountRate" type="number" min="0" max="100" step="0.01" class="item-input" placeholder="0" />
                </div>
                <div class="md:col-span-2 grid gap-3 md:grid-cols-2"><div><label class="item-label">Bulk Discount</label><button type="button" class="tiered-pricing-button" @click="item.tieredDiscounts.push({ minQuantity: 2, discountRate: 0 })">＋ Add Tiered Pricing <span>(Optional)</span></button><p class="mt-2 text-xs text-[#7b5a43]">Quantity-based discounts, such as 5% for 10+ units.</p></div><aside class="order-charge-note"><strong>ⓘ Order-level charges are not set here</strong><p>Delivery, handling, and other charges are added per Procurement request because they depend on the order destination and quantity.</p></aside></div>

                <div class="md:col-span-2 rounded-2xl border border-[#dfb98d] bg-[#fff8ef] p-4">
                  <p class="item-label">FDA Documentation</p>
                  <p class="mb-3 text-xs leading-5 text-[#7b5a43]">
                    Add one supporting PDF or image under 25 MB when applicable. Once uploaded, the document cannot be replaced. This information is shown with the product publicly.
                  </p>
                  <div class="grid gap-4 md:grid-cols-2">
                    <div>
                      <label class="item-label">FDA Registration Number</label>
                      <input v-model.trim="item.fdaRegistrationNumber" maxlength="100" type="text" class="item-input" placeholder="Optional" />
                    </div>
                    <div>
                      <label class="item-label">FDA Document</label>
                      <input v-if="!item.fdaApprovalDocument?.url && !item.fdaApprovalFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" class="item-input" @change="handleFdaDocumentChange(index, $event)" />
                      <p v-if="item.fdaApprovalFileName" class="mt-2 text-xs text-[#7b5a43]">Selected: {{ item.fdaApprovalFileName }}</p>
                      <a v-else-if="item.fdaApprovalDocument?.url" :href="item.fdaApprovalDocument.url" target="_blank" rel="noopener" class="mt-2 inline-block text-xs font-semibold text-[#8d5a3b] hover:underline">View current document</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <div class="flex flex-col gap-3 rounded-[2rem] border border-[#e4c7a1] bg-[#fffaf4] px-5 py-4 md:flex-row md:items-center md:justify-between">
            <p class="text-sm text-[#6f503d]">
              Your supply list is saved to your supplier record and can be used by procurement and logistics.
            </p>
            <button type="submit" class="rounded-xl bg-[#8d5a3b] px-5 py-3 font-semibold text-white transition hover:bg-[#6f4329]">
              Save Supply List
            </button>
          </div>
          </fieldset>
        </form>
      </section>
    </main>
    <Modal :isOpen="Boolean(selectedItem)" :panelStyle="{ backgroundColor: '#fffaf4', color: '#40261a' }" @close="selectedItem = null">
      <template #header><h2 class="text-xl font-bold">{{ selectedItem?.name || 'Supply details' }}</h2></template>
      <template #body>
        <div v-if="selectedItem" class="space-y-5 text-sm text-[#5a402f]">
          <img v-if="selectedItem.imageUrl || selectedItem.photoUrl || selectedItem.pictureUrl" :src="selectedItem.imageUrl || selectedItem.photoUrl || selectedItem.pictureUrl" :alt="selectedItem.name" class="max-h-64 w-full rounded-2xl bg-[#f7e9d8] object-contain" />
          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><dt class="item-label">Category</dt><dd>{{ selectedItem.category === 'Others' ? selectedItem.customCategory : selectedItem.category }}</dd></div>
            <div><dt class="item-label">Available / On-hand</dt><dd>{{ availableQuantity(selectedItem) }} available / {{ selectedItem.quantity }} on hand</dd></div>
            <div><dt class="item-label">Reserved for confirmed orders</dt><dd>{{ selectedItem.reservedQuantity || 0 }}</dd></div>
            <div><dt class="item-label">Price</dt><dd>{{ formatMoney(selectedItem.price ?? selectedItem.unitCost) }}</dd></div>
            <div><dt class="item-label">Default Tax</dt><dd>{{ Number(selectedItem.taxRate || 0) }}%</dd></div>
            <div><dt class="item-label">Default Discount</dt><dd>{{ Number(selectedItem.discountRate || 0) }}%</dd></div>
            <div><dt class="item-label">Other Charge / Unit</dt><dd>{{ formatMoney(selectedItem.otherChargePerUnit) }}</dd></div>
            <div><dt class="item-label">Measurement</dt><dd>{{ selectedItem.measurementValue || selectedItem.measurement || '—' }} {{ selectedItem.measurementUnit }}</dd></div>
            <div v-if="selectedItem.manufacturingDate"><dt class="item-label">Manufacturing Date</dt><dd>{{ selectedItem.manufacturingDate }}</dd></div>
            <div v-if="selectedItem.expiryDate"><dt class="item-label">Expiry Date</dt><dd>{{ selectedItem.expiryDate }}</dd></div>
            <div class="sm:col-span-2"><dt class="item-label">Description</dt><dd class="whitespace-pre-wrap break-words">{{ selectedItem.description || 'No description provided.' }}</dd></div>
            <div class="sm:col-span-2"><dt class="item-label">Specifications / Details</dt><dd class="whitespace-pre-wrap break-words">{{ selectedItem.specifications || selectedItem.details || 'No specifications provided.' }}</dd></div>
            <div><dt class="item-label">FDA Registration Number</dt><dd>{{ selectedItem.fdaRegistrationNumber || 'Not provided' }}</dd></div>
            <div><dt class="item-label">FDA Document</dt><dd><a v-if="selectedItem.fdaApprovalDocument?.url" :href="selectedItem.fdaApprovalDocument.url" target="_blank" rel="noopener" class="font-semibold text-[#8d5a3b] underline">View uploaded document</a><span v-else>Not provided</span></dd></div>
          </dl>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import './supplierTheme.css'
import { blockInvalidNumberInput, readNumberInput } from '@/utils/numericInput'
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { toast } from 'vue3-toastify'
import { db } from '@/config/firebaseConfig'
import SupplierSidebar from '@/components/sidebar/SupplierSidebar.vue'
import Modal from '@/components/common/Modal.vue'
import { OTP_BACKEND_CANDIDATES } from '@/utils/runtimeConfig'

const auth = getAuth()
const storage = getStorage()
const loading = ref(true)
const saving = ref(false)
const checkingImage = ref(false)
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const supplierDocId = ref('')
const businessName = ref('')
const items = ref([])
const savedCatalog = ref([])
const currentPage = ref(1)
const selectedItem = ref(null)
let stopCatalogListener = null
const PAGE_SIZE = 5
const totalPages = computed(() => Math.max(1, Math.ceil(savedCatalog.value.length / PAGE_SIZE)))
const paginatedItems = computed(() => savedCatalog.value.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE))
const formatMoney = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0)
const availableQuantity = (item) => Math.max(0, Number(item?.quantity || 0) - Number(item?.reservedQuantity || 0))

const categoryOptions = ['Injectables', 'Skincare', 'Equipment', 'Medical Supplies', 'Others']
const measurementOptions = ['mL', 'L', 'mg', 'g', 'kg', 'pcs', 'box', 'pack', 'set', 'unit', 'pair', 'cm', 'mm', 'dimensions', 'custom']

const createEmptyItem = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  category: '',
  customCategory: '',
  description: '',
  quantity: '',
  minOrderQuantity: '',
  measurementValue: '',
  measurementUnit: '',
  showMeasurement: false,
  specifications: '',
  manufacturingDate: '',
  expiryDate: '',
  price: '',
  taxTreatment: 'vat-inclusive',
  taxRate: 12,
  discountRate: 0,
  otherChargePerUnit: 0,
  tieredDiscounts: [],
  imageUrl: '',
  imageName: '',
  imageFile: null,
  fdaRegistrationNumber: '',
  fdaApprovalDocument: null,
  fdaApprovalFile: null,
  fdaApprovalFileName: '',
})

const activeItemCount = computed(() => savedCatalog.value.length)
const shouldShowMeasurement = (item) => ['Injectables', 'Skincare'].includes(item.category) || Boolean(item.showMeasurement || item.measurementValue || item.measurementUnit)
const shouldShowShelfLife = (item) => ['Injectables', 'Skincare', 'Medical Supplies'].includes(item.category) || Boolean(item.manufacturingDate || item.expiryDate)
const categoryCount = computed(() => {
  const categories = new Set()
  savedCatalog.value.forEach((item) => {
    const category = String(item.category || '').trim()
    const custom = String(item.customCategory || '').trim()
    const resolved = category === 'Others' ? custom : category
    if (resolved) categories.add(resolved)
  })
  return categories.size
})

const resolveSupplierDocument = async (uid) => {
  const existing = await getDocs(query(collection(db, 'suppliers'), where('ownerId', '==', uid), limit(1)))
  if (!existing.empty) {
    const snap = existing.docs[0]
    supplierDocId.value = snap.id
    return snap.data() || {}
  }
  supplierDocId.value = uid
  return {}
}

const loadSupplies = async (user) => {
  if (!user) return
  loading.value = true
  try {
    const [userSnap, supplierData] = await Promise.all([
      getDoc(doc(db, 'users', user.uid)),
      resolveSupplierDocument(user.uid),
    ])

    businessName.value =
      supplierData.businessName ||
      supplierData.name ||
      userSnap.data()?.businessName ||
      userSnap.data()?.name ||
      ''

    const currentItems = Array.isArray(supplierData.offeredItems) ? supplierData.offeredItems : []
    savedCatalog.value = currentItems.map((item) => ({ ...item, id: item.id || crypto.randomUUID() }))
    currentPage.value = 1
    items.value = [createEmptyItem()]
    stopCatalogListener?.()
    stopCatalogListener = onSnapshot(doc(db, 'suppliers', supplierDocId.value || user.uid), (snapshot) => {
      if (!snapshot.exists() || saving.value) return
      const liveItems = snapshot.data()?.offeredItems
      if (Array.isArray(liveItems)) savedCatalog.value = liveItems.map((item) => ({ ...item, id: item.id || crypto.randomUUID() }))
    }, (error) => {
      console.error('Failed to listen to supplier catalog:', error)
      toast.error('Your supplier catalog is unavailable for your current access.', { toastId: 'supplier-catalog-access' })
    })
  } finally {
    loading.value = false
  }
}

const scrollToCatalogForm = () => window.setTimeout(() => document.querySelector('[data-supplier-catalog-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
const addItemRow = () => {
  items.value.push(createEmptyItem())
  scrollToCatalogForm()
}
const handleCatalogClick = (event) => {
  if (!event.target.closest('.exact-tier')) return
  const card = event.target.closest('.exact-item-card')
  const index = [...document.querySelectorAll('.exact-item-card')].indexOf(card)
  if (index >= 0 && event.target.textContent.includes('Add Tiered')) items.value[index].tieredDiscounts.push({ minQuantity: 2, discountRate: 0 })
}

const hasDraftData = (item) => Boolean(
  item.name || item.category || item.customCategory || item.description || item.quantity ||
  item.measurementValue || item.measurementUnit || item.specifications || item.manufacturingDate || item.expiryDate || item.price || item.taxRate || item.discountRate || item.otherChargePerUnit ||
  item.imageUrl || item.fdaRegistrationNumber || item.fdaApprovalDocument || item.fdaApprovalFile
)

const editCatalogItem = (savedItem) => {
  const index = items.value.findIndex((item) => item.id === savedItem.id)
  const editable = {
    ...createEmptyItem(),
    ...savedItem,
    category: savedItem.categoryGroup || savedItem.category || '',
    customCategory: savedItem.customCategory || '',
    price: savedItem.price ?? savedItem.unitCost ?? '',
    imageFile: null,
    fdaApprovalFile: null,
    fdaApprovalFileName: '',
    showMeasurement: Boolean(savedItem.measurementValue || savedItem.measurementUnit),
  }
  // Editing is a focused operation: always reuse the first editor card rather
  // than leaving an empty Item 1 card and appending the selected item as Item 2.
  items.value = [editable]
  selectedItem.value = null
  scrollToCatalogForm()
}

const removeItemRow = (index) => {
  if (items.value[index].imageUrl.startsWith('blob:')) URL.revokeObjectURL(items.value[index].imageUrl)
  items.value.splice(index, 1)
  if (items.value.length === 0) {
    items.value.push(createEmptyItem())
  }
}

const uploadError = (files, document = false) => {
  if (files.length !== 1) return 'Please select exactly one file.'
  const file = files[0]
  if (!IMAGE_TYPES.includes(file.type) && !(document && file.type === 'application/pdf')) {
    return document ? 'Choose a PDF, JPG, PNG, WebP, or GIF document.' : 'Choose a JPG, PNG, WebP, or GIF image.'
  }
  if (!file.size || file.size >= MAX_UPLOAD_BYTES) return 'The file must be nonempty and smaller than 25 MB.'
  return ''
}

const handleItemImageChange = async (index, event) => {
  const item = items.value[index]
  const files = Array.from(event.target.files || [])
  if (!files.length) return
  const error = uploadError(files)
  event.target.value = ''
  if (error) return toast.error(error)
  checkingImage.value = true
  const preview = URL.createObjectURL(files[0])
  try {
    const image = new Image()
    image.src = preview
    await image.decode()
    if (item.imageUrl.startsWith('blob:')) URL.revokeObjectURL(item.imageUrl)
    item.imageFile = files[0]
    item.imageUrl = preview
    item.imageName = files[0].name
  } catch {
    URL.revokeObjectURL(preview)
    toast.error('This file could not be opened as an image. Choose a valid image.')
  } finally {
    checkingImage.value = false
  }
}

const handleFdaDocumentChange = (index, event) => {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (!files.length) return
  const item = items.value[index]
  if (item.fdaApprovalDocument?.url || item.fdaApprovalFile) return toast.error('Only one FDA document can be uploaded per item.')
  const error = uploadError(files, true)
  if (error) return toast.error(error)
  const file = files[0]
  items.value[index].fdaApprovalFile = file
  items.value[index].fdaApprovalFileName = file.name || ''
}

const formatPrice = (item) => {
  const value = String(item.price ?? '').trim()
  if (/^\d+(\.\d{1,2})?$/.test(value)) item.price = Number(value).toFixed(2)
}
const applyTaxTreatment = (item) => { item.taxRate = ['vat-inclusive', 'vat-exclusive'].includes(item.taxTreatment) ? 12 : 0 }

const validateItems = () => {
  for (const item of items.value) {
    const name = String(item.name || '').trim()
    const category = String(item.category || '').trim()
    const customCategory = String(item.customCategory || '').trim()
    const description = String(item.description || '').trim()
    const quantityRaw = String(item.quantity ?? '').trim()
    const quantity = Number(quantityRaw)
    const measurementValue = String(item.measurementValue || '').trim()
    const measurementUnit = String(item.measurementUnit || '').trim()
    const priceRaw = String(item.price ?? '').trim()
    const price = Number(priceRaw)
    const taxRate = Number(item.taxRate || 0), discountRate = Number(item.discountRate || 0), otherCharge = Number(item.otherChargePerUnit || 0)

    const hasAnyData =
      name ||
      category ||
      customCategory ||
      description ||
      measurementValue ||
      measurementUnit ||
      String(item.specifications || '').trim() ||
      String(item.imageUrl || '').trim() ||
      quantityRaw || priceRaw || item.fdaRegistrationNumber || item.fdaApprovalFile || item.fdaApprovalDocument

    if (!hasAnyData) continue

    if (!name) return 'Please enter an item name for each filled row.'
    if (!categoryOptions.includes(category)) return 'Please choose a category for each item.'
    if (category === 'Others' && !customCategory) return 'Please enter the custom category for items marked as Others.'
    if (!quantityRaw) return 'Please enter a quantity for each filled item.'
    if (!/^\d+$/.test(quantityRaw) || !Number.isSafeInteger(quantity) || quantity < 0) return 'Quantity must be a whole number of zero or more.'
    if (quantity < Number(item.reservedQuantity || 0)) return `Quantity cannot be lower than the ${item.reservedQuantity} unit(s) reserved for confirmed orders.`
    if (!priceRaw) return 'Please enter a price for each filled item.'
    if (!/^\d+(\.\d{1,2})?$/.test(priceRaw) || !Number.isFinite(price) || price < 0 || price > 999999999.99) return 'Price must be between PHP 0.00 and PHP 999,999,999.99 with at most two decimal places.'
    if (![taxRate, discountRate, otherCharge].every(Number.isFinite) || taxRate < 0 || taxRate > 100 || discountRate < 0 || discountRate > 100 || otherCharge < 0 || otherCharge > 999999999.99) return 'Tax and discount rates must be 0–100%; other charge must be a valid positive PHP amount.'
    const tiers = Array.isArray(item.tieredDiscounts) ? item.tieredDiscounts : []
    if (tiers.length > 10 || tiers.some((tier) => !Number.isSafeInteger(Number(tier.minQuantity)) || Number(tier.minQuantity) < 2 || !Number.isFinite(Number(tier.discountRate)) || Number(tier.discountRate) < 0 || Number(tier.discountRate) > 100) || new Set(tiers.map(tier => Number(tier.minQuantity))).size !== tiers.length) return 'Bulk discount tiers need unique quantities of 2 or more and rates from 0–100%.'
    if (name.length > 120 || customCategory.length > 80 || description.length > 2000 || String(item.specifications || '').length > 2000 || measurementValue.length > 80 || String(item.fdaRegistrationNumber || '').length > 100) return 'An item field exceeds its maximum length.'
    if (measurementValue && !measurementUnit) return 'Please select a unit for the measurement.'
    if (measurementUnit && !measurementOptions.includes(measurementUnit)) return 'Please select a valid measurement unit.'
    if (measurementValue && !/^\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)*$/i.test(measurementValue)) return 'Use a positive number or dimensions such as 2x3 for measurements.'
    if (measurementValue && measurementValue.split(/[x×]/i).some((part) => Number(part) <= 0)) return 'Measurement values must be greater than zero.'
    if (measurementUnit === 'custom' && !String(item.specifications || '').trim()) return 'Describe the custom unit in Specifications / Details.'
    if (item.manufacturingDate && item.expiryDate && item.expiryDate < item.manufacturingDate) return 'Expiry date cannot be earlier than the manufacturing date.'
    if (item.imageFile && uploadError([item.imageFile])) return uploadError([item.imageFile])
    if (item.fdaApprovalFile && uploadError([item.fdaApprovalFile], true)) return uploadError([item.fdaApprovalFile], true)
    if (!measurementValue && measurementUnit) return 'Please provide a measurement value when selecting a unit.'
  }
  return ''
}

const saveSupplies = async () => {
  if (loading.value || saving.value || checkingImage.value) return
  const user = auth.currentUser
  if (!user) {
    toast.error('You are not signed in.')
    return
  }

  const validationMessage = validateItems()
  if (validationMessage) {
    toast.error(validationMessage)
    return
  }

  const cleanedItems = items.value
    .map((item) => {
      const name = String(item.name || '').trim()
      if (!name) return null

      const category = String(item.category || '').trim()
      const customCategory = String(item.customCategory || '').trim()
      const resolvedCategory = category === 'Others' ? customCategory : category

      return {
        source: item,
        id: item.id,
        imageFile: item.imageFile,
        name,
        category: resolvedCategory,
        categoryGroup: category,
        customCategory,
        description: String(item.description || '').trim(),
        quantity: Number(item.quantity || 0),
        minOrderQuantity: Number(item.minOrderQuantity || 0),
        measurementValue: String(item.measurementValue || '').trim(),
        measurementUnit: String(item.measurementUnit || '').trim(),
        specifications: String(item.specifications || '').trim(),
        manufacturingDate: String(item.manufacturingDate || '').trim(),
        expiryDate: String(item.expiryDate || '').trim(),
        price: Number(item.price || 0),
        unitCost: Number(item.price || 0),
        taxTreatment: String(item.taxTreatment || 'vat-inclusive'),
        taxRate: Number(item.taxRate || 0),
        discountRate: Number(item.discountRate || 0),
        otherChargePerUnit: Number(item.otherChargePerUnit || 0),
        tieredDiscounts: (item.tieredDiscounts || []).map(tier => ({ minQuantity: Number(tier.minQuantity), discountRate: Number(tier.discountRate) })),
        imageUrl: String(item.imageUrl || '').trim(),
        imageName: String(item.imageName || '').trim(),
        fdaRegistrationNumber: String(item.fdaRegistrationNumber || '').trim(),
        fdaApprovalDocument: item.fdaApprovalDocument || null,
        fdaApprovalFile: item.fdaApprovalFile || null,
      }
    })
    .filter(Boolean)

  if (!cleanedItems.length) {
    toast.error('Please add an item before saving.')
    return
  }
  saving.value = true
  try {
    const savedItems = []
    for (const item of cleanedItems) {
      let imageUrl = item.imageUrl
      if (item.imageFile) {
        const fileRef = storageRef(storage, `supplier-item-images/${user.uid}/${item.id}/${crypto.randomUUID()}`)
        const snapshot = await uploadBytes(fileRef, item.imageFile)
        imageUrl = await getDownloadURL(snapshot.ref)
        if (item.source.imageUrl.startsWith('blob:')) URL.revokeObjectURL(item.source.imageUrl)
        item.source.imageUrl = imageUrl
        item.source.imageFile = null
      }
      let fdaApprovalDocument = item.fdaApprovalDocument || null
      if (item.fdaApprovalFile && !fdaApprovalDocument?.url) {
        const path = `supplier-fda-documents/${user.uid}/${item.id}/document`
        const fileRef = storageRef(storage, path)
        let documentUrl
        try {
          documentUrl = await getDownloadURL(fileRef)
        } catch (error) {
          if (error.code !== 'storage/object-not-found') throw error
          const snapshot = await uploadBytes(fileRef, item.fdaApprovalFile)
          documentUrl = await getDownloadURL(snapshot.ref)
        }
        fdaApprovalDocument = {
          name: item.fdaApprovalFile.name,
          type: item.fdaApprovalFile.type || '',
          size: item.fdaApprovalFile.size || 0,
          path,
          url: documentUrl,
        }
        item.source.fdaApprovalDocument = fdaApprovalDocument
        item.source.fdaApprovalFile = null
        item.source.fdaApprovalFileName = ''
      }
      savedItems.push({
        id: item.id,
        name: item.name,
        category: item.category,
        categoryGroup: item.categoryGroup,
        customCategory: item.customCategory,
        description: item.description,
        quantity: item.quantity,
        minOrderQuantity: item.minOrderQuantity,
        measurementValue: item.measurementValue,
        measurementUnit: item.measurementUnit,
        specifications: item.specifications,
        manufacturingDate: item.manufacturingDate,
        expiryDate: item.expiryDate,
        price: item.price,
        unitCost: item.unitCost,
        taxTreatment: item.taxTreatment,
        taxRate: item.taxRate,
        discountRate: item.discountRate,
        otherChargePerUnit: item.otherChargePerUnit,
        tieredDiscounts: item.tieredDiscounts,
        imageUrl,
        imageName: item.imageName,
        fdaRegistrationNumber: item.fdaRegistrationNumber,
        fdaApprovalDocument,
      })
    }
    const token = await user.getIdToken()
    let result
    for (const base of OTP_BACKEND_CANDIDATES) {
      const response = await fetch(`${base}/supply/catalog`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ supplierId: supplierDocId.value || user.uid, items: savedItems }) })
      result = await response.json()
      if (response.ok && result.success) break
      if (!response.ok) throw new Error(result.error || 'Unable to save the catalog.')
    }
    if (!result?.success) throw new Error(result?.error || 'Catalog service is unavailable.')
    const combinedItems = result.data.items

    savedCatalog.value = combinedItems.map((item) => ({ ...item, id: item.id || crypto.randomUUID() }))
    currentPage.value = 1
    items.value = [createEmptyItem()]
    toast.success('Supply list saved successfully.')
  } catch (error) {
    console.error('Failed to save supplies:', error)
    toast.error('Failed to save supply list.')
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  stopCatalogListener?.()
  items.value.forEach((item) => {
    if (item.imageUrl.startsWith('blob:')) URL.revokeObjectURL(item.imageUrl)
  })
})

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      loading.value = false
      return
    }
    loadSupplies(user)
  })
})
</script>

<style scoped>
.supplier-catalog-page { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-weight: 400; }
.supplier-catalog-page h1, .supplier-catalog-page h2, .supplier-catalog-page h3, .supplier-catalog-page strong, .supplier-catalog-page .font-bold, .supplier-catalog-page .font-semibold { font-weight: 600; }
.catalog-button { border: 1px solid #d9b38d; border-radius: 0.75rem; background: #fff8ef; padding: 0.5rem 0.85rem; color: #6f4329; font-weight: 500; }
.legacy-catalog-form { display: none; }
.exact-catalog-form { margin-top: 1.5rem; color: #273047; font-family: inherit; }
.exact-item-card { overflow: hidden; border: 1px solid #edc7a4; border-radius: 1.6rem; background: #fffdfb; box-shadow: 0 10px 28px rgba(105, 67, 35, .09); }
.exact-item-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.15rem 1.6rem; border-bottom:1px solid #f1ddcc; background:linear-gradient(90deg,#fffdfb,#fff8f1); }.exact-item-header p,.exact-left label,.exact-right label { display:block; color:#4b5770; font-size:.72rem; font-weight:600; letter-spacing:.06em; }.exact-item-header h2{margin:.15rem 0;font-size:1.5rem;font-weight:600}.exact-item-header span{color:#77829a;font-size:.86rem}.exact-item-header button{border:1px solid #f0b99d;border-radius:.7rem;background:#fff9f6;padding:.7rem 1rem;color:#bd4429;font-weight:500}.exact-item-content{display:grid;grid-template-columns:1fr 1fr;gap:1.4rem;padding:1.5rem}.exact-left{padding-right:1.4rem;border-right:1px solid #f1e2d5}.exact-left,.exact-right{display:grid;align-content:start;gap:1rem}.exact-left input,.exact-left select,.exact-left textarea,.exact-right input,.exact-right select,.exact-right textarea{width:100%;box-sizing:border-box;margin-top:.45rem;border:1px solid #e9bb92;border-radius:.75rem;background:#fffefd;padding:.85rem 1rem;color:#273047;font-size:.88rem;font-weight:400}.exact-left input::placeholder,.exact-left textarea::placeholder,.exact-right input::placeholder,.exact-right textarea::placeholder{font-weight:400}.exact-left textarea,.exact-right textarea{resize:vertical}.exact-left em,.exact-right em{color:#d64b36;font-style:normal}.exact-image{display:flex;min-height:275px;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;border:1px dashed #eead75;border-radius:.75rem;background:linear-gradient(135deg,#fff4e7,#fffbf5);text-align:center;color:#6d6d71}.exact-image img{max-height:270px;width:100%;object-fit:contain}.exact-image strong{font-size:2.6rem;color:#c6a185}.exact-image span{font-size:.8rem;color:#7c8395}.exact-image label,.exact-package button,.exact-tier{border:1px solid #e28b57;border-radius:.6rem;background:#fffdfb;padding:.65rem 1rem;color:#c54a2d;font-weight:500;letter-spacing:0}.exact-pair{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.exact-right>small{margin-top:-.7rem;color:#7c8395;font-size:.77rem}.exact-package{display:grid;gap:.55rem;border:1px dashed #edaf77;border-radius:.75rem;background:#fffaf4;padding:1rem}.exact-package b,.exact-right aside b{font-weight:600}.exact-package span{color:#7c8395;font-size:.8rem}.exact-package button{justify-self:start}.exact-price{display:flex;overflow:hidden;margin-top:.45rem;border:1px solid #e9bb92;border-radius:.75rem}.exact-price b{padding:.85rem 1rem;background:#fff7ed;font-weight:500}.exact-price input{margin:0!important;border:0!important;border-radius:0!important}.exact-tax-note{margin-top:-.5rem;color:#7c8395;font-size:.74rem}.exact-right aside{display:flex;gap:.75rem;border:1px solid #b9ddfc;border-radius:.75rem;background:#f1f9ff;padding:1rem;color:#245384;font-size:.8rem}.exact-right aside b,.exact-right aside span{display:block}.exact-right aside span{margin-top:.25rem}.exact-item-card footer{display:flex;justify-content:flex-end;gap:1rem;border-top:1px solid #f1e2d5;padding:1.25rem 1.6rem}.exact-item-card footer button{min-width:120px;border:1px solid #e5b78f;border-radius:.7rem;background:#fffdfb;padding:.8rem 1rem;font-weight:500}.exact-item-card footer button[type=submit]{border-color:#c84e2c;background:#c84e2c;color:#fff}@media(max-width:780px){.exact-item-content{grid-template-columns:1fr}.exact-left{padding-right:0;border-right:0;border-bottom:1px solid #f1e2d5;padding-bottom:1.4rem}.exact-pair{grid-template-columns:1fr}.exact-item-header{align-items:flex-start;flex-direction:column}}
.catalog-button:hover:not(:disabled) { background: #f7ead8; }
.catalog-button:disabled { cursor: not-allowed; }
.supplier-item-card { border-color: #edc8a6; background: #fffdfb; box-shadow: 0 16px 42px rgba(128, 77, 35, .10); }
.supplier-item-header { min-height: 108px; padding: 1.25rem 1.65rem; background: linear-gradient(90deg, #fffdfb, #fff8f0); }
.supplier-item-header h2 { font-size: 1.55rem; letter-spacing: -.025em; }
.supplier-item-header > button { border-color: #f1b99d; background: #fff9f5; color: #bd4429; }
.supplier-item-grid { gap: 1.45rem; padding: 1.5rem 1.65rem; }
.supplier-item-details { padding-right: 1.35rem; border-right: 1px solid #f2e1d3; }
.supplier-image-panel { min-height: 300px; border-color: #f0b586; background: linear-gradient(135deg, #fff5e9, #fffaf4); }
.supplier-image-panel > div { min-height: 260px; }
.supplier-image-panel img { border-radius: .85rem; }
.supplier-item-pricing { align-content: start; }
.price-field { display: flex; align-items: center; border: 1px solid rgba(224, 192, 154, 0.95); border-radius: 1rem; background: white; overflow: hidden; }
.price-prefix { flex: none; padding-left: 1rem; color: #8f6a4d; font-size: 0.875rem; }
.price-field .price-input { min-width: 0; border: 0; border-radius: 0; padding-left: 0.75rem; }
.price-field:focus-within { box-shadow: 0 0 0 4px rgba(214, 169, 123, 0.16); }
button:disabled { opacity: 0.6; cursor: wait; }
.item-label {
  display: block;
  margin-bottom: 0.45rem;
  color: #8c6d55;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.item-input {
  width: 100%;
  border-radius: 1rem;
  border: 1px solid rgba(224, 192, 154, 0.95);
  background: rgba(255, 255, 255, 0.96);
  padding: 0.9rem 1rem;
  color: #342419;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.item-textarea {
  resize: vertical;
  min-height: 6rem;
}

.item-input:focus {
  border-color: rgba(198, 148, 108, 0.95);
  box-shadow: 0 0 0 4px rgba(214, 169, 123, 0.16);
}
.item-input { border-radius: .8rem; min-height: 3.15rem; }
.item-textarea { min-height: 7.8rem; }
.tiered-pricing-button { width: 100%; border: 1px solid #e5b887; border-radius: 1rem; background: #fffaf4; padding: 0.9rem 1rem; color: #bd4e2d; font-weight: 700; }
.tiered-pricing-button span { color: #8c6d55; font-weight: 400; }
.order-charge-note { border: 1px solid #b8dcfb; border-radius: 1rem; background: #f0f9ff; padding: 1rem; color: #315a87; font-size: .82rem; line-height: 1.45; }
.order-charge-note strong { display: block; margin-bottom: .35rem; color: #234879; }
@media (max-width: 1023px) { .supplier-item-details { padding-right: 0; border-right: 0; border-bottom: 1px solid #f2e1d3; padding-bottom: 1.4rem; } }
.exact-fda{margin:0 1.6rem 1.4rem;border-top:1px solid #f1e2d5;padding-top:1.25rem}.exact-fda h3{font-weight:600}.exact-fda h3 span,.exact-fda>p{color:#7c8395;font-size:.8rem}.exact-fda>p{margin:.25rem 0 1rem}.exact-fda label{display:block;color:#4b5770;font-size:.72rem;font-weight:600;letter-spacing:.06em}.exact-fda input{width:100%;box-sizing:border-box;margin-top:.45rem;border:1px solid #e9bb92;border-radius:.75rem;background:#fffefd;padding:.85rem 1rem;color:#273047;font-weight:400}
</style>
