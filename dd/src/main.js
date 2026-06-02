import './style.css'

const form = document.querySelector('#signup-form')
const emailInput = document.querySelector('#email')
const message = document.querySelector('#form-message')

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const email = emailInput.value.trim()

  if (!email) {
    message.textContent = 'Enter your email first.'
    return
  }

  message.textContent = 'You’re on the list. The dungeon opens soon.'
  form.reset()
})