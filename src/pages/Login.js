import { useEffect, useRef, useState } from "react";
import { auth, setupRecaptchaVerifier } from "../firebase";
import { signInWithPhoneNumber } from "firebase/auth";
import seremeetyLogo from "../images/img_seremeety_logo.png";
import LoginForm from "../components/login/LoginForm";
import { toLocalePhoneNumber, toIntlPhoneNumber } from "../utils";
import Swal from "sweetalert2";

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
        const input = e.target.value;
        if (/^[\d-]*$/.test(input)) {
            const localePhoneNumber = toLocalePhoneNumber(input);
            setPhoneNumber(localePhoneNumber);
        }
    };

    const handleCodeChange = (e) => {
        const input = e.target.value;
        if (/^\d*$/.test(input)) {
            setVerificationCode(input);
        }
    };

    const handleSendCode = async () => {
        if (!phoneNumber) {
            Swal.fire({
                title: "전화번호 입력",
                text: "전화번호를 입력해주세요",
                icon: "warning",
                confirmButtonText: "확인"
            });
            return;
        }
        try {
            await appVerifier.render();
            const confirmationResult = await signInWithPhoneNumber(auth, toIntlPhoneNumber(phoneNumber), appVerifier);
            window.confirmationResult = confirmationResult;
            Swal.fire({
                title: "인증번호 전송",
                text: "인증번호가 전송되었습니다",
                icon: "success",
                confirmButtonText: "확인"
            });
        } catch (error) {
            console.log(error);
            Swal.fire({
                title: "인증번호 전송 실패",
                text: "잘못된 전화번호이거나 오류가 발생했습니다",
                icon: "error",
                confirmButtonText: "확인"
            });
        }
    };

    const handleVerifyCode = async () => {
        if (!verificationCode) {
            Swal.fire({
                title: "인증번호 입력",
                text: "인증번호를 입력해주세요",
                icon: "warning",
                confirmButtonText: "확인"
            });
            return;
        }

        if (!window.confirmationResult) {
            console.log("verification error");
            Swal.fire({
                title: "인증 실패",
                text: "인증에 오류가 발생했습니다",
                icon: "error",
                confirmButtonText: "확인"
            });
            return;
        }

        try {
            await window.confirmationResult.confirm(verificationCode);
            console.log("user login");
        } catch (error) {
            console.log(error);
            Swal.fire({
                title: "로그인 실패",
                text: "잘못된 인증번호이거나 오류가 발생했습니다",
                icon: "error",
                cancelButtonText: "확인"
            });
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
                maxLength={13}
                btnText={"인증"}
                onSubmit={handleSendCode}
            />
            <LoginForm
                type={"text"}
                value={verificationCode}
                onChange={handleCodeChange}
                placeholder={"인증번호"}
                maxLength={6}
                btnText={"로그인"}
                onSubmit={handleVerifyCode}
            />
            <div ref={recaptchaRef}></div>
        </div>
    );
};

export default Login;