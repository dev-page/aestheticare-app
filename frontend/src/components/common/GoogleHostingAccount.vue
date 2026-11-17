<template>
  <section class="google-hosting-account">
    <h2>Google Meet rooms</h2>
    <p>Create the room in Google Meet while signed in to the account that should host the call. Return here and attach the room link to the checked-in appointment.</p>
    <a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer">Open Google Meet</a>
  </section>
</template>

<style scoped>
.google-hosting-account { margin-bottom: 24px; padding: 20px; border: 1px solid var(--ac-border); border-radius: 14px; background: var(--ac-surface); color: var(--ac-text); }
h2 { margin: 0; font-size: 18px; font-weight: 700; }
p { margin: 8px 0 14px; font-size: 13px; line-height: 1.6; color: var(--ac-text-secondary); }
a { display: inline-flex; padding: 10px 14px; border: 1px solid var(--ac-primary); border-radius: 8px; background: var(--ac-primary); color: var(--ac-on-primary); font-size: 13px; font-weight: 600; text-decoration: none; }
a:focus-visible { outline: 2px solid var(--ac-accent); outline-offset: 3px; }
</style>
