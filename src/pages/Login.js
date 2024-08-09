import { useEffect, useRef, useState } from "react";
import { auth, setupRecaptchaVerifier } from "../firebase";
import { signInWithPhoneNumber } from "firebase/auth";
import seremeetyLogo from "../images/img_seremeety_logo.png";
import LoginForm from "../components/login/LoginForm";

const Login = () => {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const recaptchaRef = useRef(null);
    const appVerifier = window.recaptchaVerifier;

    useEffect(() => {
        if (recaptchaRef.current) {
            setupRecaptchaVerifier(recaptchaRef.current);
        }
    }, []);

    const handlePhoneNumberChange = (e) => {
        setPhoneNumber(e.target.value);
    };

    const handleCodeChange = (e) => {
        setVerificationCode(e.target.value);
    };

    const handleSendCode = async () => {
        try {
            const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
            window.confirmationResult = confirmationResult;
            console.log("code sent");
        } catch (error) {
            console.log(error);
        }
    };

    const handleVerifyCode = async () => {
        try {
            await window.confirmationResult.confirm(verificationCode);
            console.log("로그인 성공");
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <div className="Login">
            <img alt="SEREMEETY"
                src={seremeetyLogo}
                style={{ display: "block", width: "80%", margin: "40px auto"}}
            />
            <LoginForm
                type={"tel"}
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                placeholder={"010-1234-5678"}
                btnText={"인증"}
                onSubmit={handleSendCode}
            />
            <LoginForm
                type={"text"}
                value={verificationCode}
                onChange={handleCodeChange}
                placeholder={"인증번호"}
                btnText={"로그인"}
                onSubmit={handleVerifyCode}
            />
            <div ref={recaptchaRef}></div>
        </div>
    );
};

export default Login;