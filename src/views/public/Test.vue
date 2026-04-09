<template>
  <div>
    <input type="file" @change="onFileSelect" />
    <button @click="handleFileUpload" :disabled="!selectedFile">
      Upload
    </button>

    <div v-if="imageUrl">
      <h3>Uploaded Image:</h3>
      <img :src="imageUrl" alt="Uploaded Image" style="max-width: 300px;" />
    </div>
  </div>
</template>
<script setup>
import { ref } from "vue"
import axios from "axios"

const selectedFile = ref(null)
const imageUrl = ref(null)

function onFileSelect(event) {
  selectedFile.value = event.target.files[0]
}

async function handleFileUpload() {
  if (!selectedFile.value) return

  const formData = new FormData()
  formData.append("file", selectedFile.value)

  try {
    const response = await axios.post("http://localhost:3000/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })

    // ✅ Use permanent public URL
    imageUrl.value = response.data.url
    console.log("Uploaded via backend:", response.data)
  } catch (err) {
    console.error("Upload failed:", err)
  }
}
</script>
