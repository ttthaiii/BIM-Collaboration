function togglePassword() {
  const passwordField = document.getElementById('password');
  const toggleIcon = document.querySelector('.password-toggle');
  if (passwordField.type === 'password') {
      passwordField.type = 'text';
      toggleIcon.classList.remove('fa-eye');
      toggleIcon.classList.add('fa-eye-slash');
  } else {
      passwordField.type = 'password';
      toggleIcon.classList.remove('fa-eye-slash');
      toggleIcon.classList.add('fa-eye');
  }
}
