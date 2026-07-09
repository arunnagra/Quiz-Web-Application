const name = document.getElementById("name");
const email = document.getElementById("email");
const phoneNumber = document.getElementById("phone-number");
const date = document.getElementById("date");
const button = document.getElementById("submit");
const genderSelect = document.getElementById("gender");
const form = document.getElementById("registrationForm");
const errorMsg = document.getElementById("error-msg");
const ageDisplay = document.getElementById("age");

function calculateAge(dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

date.addEventListener("change", () => {
    if (date.value) {
        const age = calculateAge(date.value);
        ageDisplay.textContent = `Age: ${age} years`;
    } else {
        ageDisplay.textContent = "";
    }
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = name.value.trim();
    const useremail = email.value.trim();
    const userphone = phoneNumber.value.trim();
    const usergender = genderSelect.value.trim();
    const userdob = date.value.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{10}$/;

    errorMsg.textContent = "";

    if (!username || !useremail || !userphone || !usergender || !userdob) {
        errorMsg.textContent = "All fields are mandatory.";
        return;
    }

    if (!emailRegex.test(useremail)) {
        errorMsg.textContent = "Invalid email format.";
        return;
    }

    if (!phoneRegex.test(userphone)) {
        errorMsg.textContent = "Phone number must be 10 digits.";
        return;
    }

    const age = calculateAge(userdob);
    if (age < 10) {
        errorMsg.textContent = "Age wise, you are not eligible.";
        return;
    }

    const userdetails = {
        username,
        useremail,
        userphone,
        usergender,
        userdob,
    };

    button.disabled = true;
    errorMsg.textContent = "Redirecting...";

    try {
        const res = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userdetails),
        });
        const result = await res.json();

        if (res.ok) {
            window.location.href = "/test";
        } else {
            errorMsg.textContent = result.error || "Registration failed.";
            button.disabled = false;
        }
    } catch (err) {
        console.error("Registration error:", err);
        errorMsg.textContent = "Something went wrong.";
        button.disabled = false;
    }
});
