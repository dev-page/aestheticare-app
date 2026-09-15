<template>
  <div class="flex min-h-screen bg-gradient-to-br from-[#f9f1e5] via-[#f5e4cf] to-[#eed6bc]">
    <SupplierSidebar />

    <main class="flex-1 p-6 md:p-8">
      <section class="mx-auto max-w-7xl space-y-6">
        <div class="rounded-[2rem] border border-[#e4c7a1] bg-white/85 p-6 shadow-[0_18px_44px_rgba(77,52,31,0.08)] backdrop-blur">
          <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6848]">Supplier Supplies</p>
              <h1 class="mt-2 text-3xl font-bold text-[#40261a]">Manage your item catalog</h1>
              <p class="mt-2 max-w-3xl text-sm leading-6 text-[#6f503d]">
                Add the products, equipment, and medical supplies that your business offers. For equipment, you can use units like set, unit, pair, box, dimensions, or weight depending on the item.
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-xl bg-[#8d5a3b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6f4329]" :disabled="loading || saving || checkingImage" @click="addItemRow">
                Add Item
              </button>
              <button type="button" class="rounded-xl border border-[#d9b38d] bg-[#fff8ef] px-4 py-2 text-sm font-semibold text-[#6f4329] transition hover:bg-[#f7ead8]" :disabled="loading || saving || checkingImage" @click="saveSupplies">
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

        <form v-else class="space-y-5" @submit.prevent="saveSupplies">
          <fieldset :disabled="saving || checkingImage" class="min-w-0 space-y-5">
          <article
            v-for="(item, index) in items"
            :key="item.id"
            class="overflow-hidden rounded-[2rem] border border-[#e4c7a1] bg-white/90 shadow-[0_12px_30px_rgba(77,52,31,0.06)]"
          >
            <div class="flex flex-col gap-3 border-b border-[#ecd9c0] px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#9a6848]">Item {{ index + 1 }}</p>
                <h2 class="mt-1 text-xl font-bold text-[#40261a]">{{ item.name || 'New item' }}</h2>
              </div>
              <button
                type="button"
                class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                @click="removeItemRow(index)"
              >
                Remove
              </button>
            </div>

            <div class="grid gap-5 px-5 py-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div class="space-y-4">
                <div class="overflow-hidden rounded-2xl border border-dashed border-[#dfb98d] bg-[#fff8ef] p-4">
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

              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="item-label">Quantity</label>
                  <input :value="item.quantity" type="text" inputmode="numeric" @beforeinput="blockInvalidNumberInput($event)" @input="item.quantity = readNumberInput($event, item.quantity)" class="item-input" placeholder="0" />
                </div>

                <div>
                  <label class="item-label">Measurement Value</label>
                  <input v-model="item.measurementValue" maxlength="80" type="text" class="item-input" placeholder="e.g. 10, 500, 2x3" />
                </div>

                <div class="md:col-span-2">
                  <label class="item-label">Measurement Unit</label>
                  <select v-model="item.measurementUnit" class="item-input">
                    <option value="">Select unit</option>
                    <option v-for="unit in measurementOptions" :key="unit" :value="unit">{{ unit }}</option>
                  </select>
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

                <div>
                  <label class="item-label">Price</label>
                  <div class="price-field">
                    <span class="price-prefix">PHP</span>
                    <input :value="item.price" @beforeinput="blockInvalidNumberInput($event, true)" @input="item.price = readNumberInput($event, item.price, true)" aria-label="Price in Philippine pesos" type="text" inputmode="decimal" maxlength="12" class="item-input price-input" placeholder="0.00" @blur="formatPrice(item)" />
                  </div>
                </div>

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
  </div>
</template>

<script setup>
import { blockInvalidNumberInput, readNumberInput } from '@/utils/numericInput'
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { toast } from 'vue3-toastify'
import { db } from '@/config/firebaseConfig'
import SupplierSidebar from '@/components/sidebar/SupplierSidebar.vue'

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

const categoryOptions = ['Injectables', 'Skincare', 'Equipment', 'Medical Supplies', 'Others']
const measurementOptions = ['mL', 'L', 'mg', 'g', 'kg', 'pcs', 'box', 'pack', 'set', 'unit', 'pair', 'cm', 'mm', 'dimensions', 'custom']

const createEmptyItem = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  category: '',
  customCategory: '',
  description: '',
  quantity: '',
  measurementValue: '',
  measurementUnit: '',
  specifications: '',
  price: '',
  imageUrl: '',
  imageName: '',
  imageFile: null,
  fdaRegistrationNumber: '',
  fdaApprovalDocument: null,
  fdaApprovalFile: null,
  fdaApprovalFileName: '',
})

const activeItemCount = computed(() => items.value.filter((item) => String(item.name || '').trim()).length)
const categoryCount = computed(() => {
  const categories = new Set()
  items.value.forEach((item) => {
    const category = String(item.category || '').trim()
    const custom = String(item.customCategory || '').trim()
    const resolved = category === 'Others' ? custom : category
    if (resolved) categories.add(resolved)
  })
  return categories.size
})

const normalizeItemFromStore = (item = {}) => ({
  id: item.id || crypto.randomUUID(),
  name: item.name || '',
  category: item.categoryGroup || (categoryOptions.includes(item.category) ? item.category : (item.category ? 'Others' : '')),
  customCategory: item.category === 'Others' ? (item.customCategory || item.otherCategory || '') : (item.customCategory || ''),
  description: item.description || '',
  quantity: item.quantity ?? '',
  measurementValue: item.measurementValue ?? item.measurement ?? '',
  measurementUnit: item.measurementUnit || '',
  specifications: item.specifications || item.details || '',
  price: item.price ?? item.unitCost ?? '',
  imageUrl: item.imageUrl || item.photoUrl || item.pictureUrl || '',
  imageName: item.imageName || '',
  imageFile: null,
  fdaRegistrationNumber: item.fdaRegistrationNumber || '',
  fdaApprovalDocument: item.fdaApprovalDocument || null,
  fdaApprovalFile: null,
  fdaApprovalFileName: '',
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
    items.value = currentItems.length ? currentItems.map((item) => normalizeItemFromStore(item)) : [createEmptyItem()]
  } finally {
    loading.value = false
  }
}

const addItemRow = () => {
  items.value.push(createEmptyItem())
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
    if (!priceRaw) return 'Please enter a price for each filled item.'
    if (!/^\d+(\.\d{1,2})?$/.test(priceRaw) || !Number.isFinite(price) || price < 0 || price > 999999999.99) return 'Price must be between PHP 0.00 and PHP 999,999,999.99 with at most two decimal places.'
    if (name.length > 120 || customCategory.length > 80 || description.length > 2000 || String(item.specifications || '').length > 2000 || measurementValue.length > 80 || String(item.fdaRegistrationNumber || '').length > 100) return 'An item field exceeds its maximum length.'
    if (measurementValue && !measurementUnit) return 'Please select a unit for the measurement.'
    if (measurementUnit && !measurementOptions.includes(measurementUnit)) return 'Please select a valid measurement unit.'
    if (measurementValue && !/^\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)*$/i.test(measurementValue)) return 'Use a positive number or dimensions such as 2x3 for measurements.'
    if (measurementValue && measurementValue.split(/[x×]/i).some((part) => Number(part) <= 0)) return 'Measurement values must be greater than zero.'
    if (measurementUnit === 'custom' && !String(item.specifications || '').trim()) return 'Describe the custom unit in Specifications / Details.'
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
        measurementValue: String(item.measurementValue || '').trim(),
        measurementUnit: String(item.measurementUnit || '').trim(),
        specifications: String(item.specifications || '').trim(),
        price: Number(item.price || 0),
        unitCost: Number(item.price || 0),
        imageUrl: String(item.imageUrl || '').trim(),
        imageName: String(item.imageName || '').trim(),
        fdaRegistrationNumber: String(item.fdaRegistrationNumber || '').trim(),
        fdaApprovalDocument: item.fdaApprovalDocument || null,
        fdaApprovalFile: item.fdaApprovalFile || null,
      }
    })
    .filter(Boolean)

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
        measurementValue: item.measurementValue,
        measurementUnit: item.measurementUnit,
        specifications: item.specifications,
        price: item.price,
        unitCost: item.unitCost,
        imageUrl,
        imageName: item.imageName,
        fdaRegistrationNumber: item.fdaRegistrationNumber,
        fdaApprovalDocument,
      })
    }
    const categories = [...new Set(savedItems.map((item) => item.category).filter(Boolean))]
    await setDoc(doc(db, 'suppliers', supplierDocId.value || user.uid), {
      ownerId: user.uid,
      name: businessName.value || '',
      businessName: businessName.value || '',
      offeredItems: savedItems,
      categories,
      updatedAt: serverTimestamp(),
    }, { merge: true })

    items.value = savedItems.length ? savedItems.map(normalizeItemFromStore) : [createEmptyItem()]
    toast.success('Supply list saved successfully.')
  } catch (error) {
    console.error('Failed to save supplies:', error)
    toast.error('Failed to save supply list.')
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
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
</style>
