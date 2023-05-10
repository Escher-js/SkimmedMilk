const form = document.getElementById('git-config-form');
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;

    const result = await window.git.setConfig(username, email);
    if (result === 'success') {
        alert('Git configuration updated successfully.');
        window.close();
    } else {
        alert(`Error: ${result}`);
    }
});