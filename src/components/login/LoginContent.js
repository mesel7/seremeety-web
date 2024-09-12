import { useCallback, useEffect, useRef, useState } from "react";
import React from "react";
import "./LoginContent.css";
import { auth, setupRecaptchaVerifier } from "../../firebase";
import { toIntlPhoneNumber, toLocalePhoneNumber } from "../../utils";
import { signInWithPhoneNumber } from "firebase/auth";
import Swal from "sweetalert2";
import LoginLogo from "./LoginLogo";
import LoginForm from "./LoginForm";

const LoginContent = () => {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const recaptchaRef = useRef(null);
    const appVerifier = window.recaptchaVerifier;

    useEffect(() => {
        if (recaptchaRef.current) {
            setupRecaptchaVerifier(recaptchaRef.current);
        }
    }, []);

    const handlePhoneNumberChange = useCallback((e) => {
        const input = e.target.value;
        if (/^[\d-]*$/.test(input)) {
            setPhoneNumber((prev) => toLocalePhoneNumber(input));
        }
    }, []);
    
    const handleCodeChange = useCallback((e) => {
        const input = e.target.value;
        if (/^\d*$/.test(input)) {
            setVerificationCode((prev) => input);
        }
    }, []);
    

    const handleSendCode = useCallback(async () => {
        if (!phoneNumber) {
            Swal.fire({
                title: "전화번호 입력",
                text: "전화번호를 입력해주세요",
                icon: "warning",
                confirmButtonText: "확인",
                customClass: {
                    confirmButton: 'no-focus-outline'
                },
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
                confirmButtonText: "확인",
                customClass: {
                    confirmButton: 'no-focus-outline'
                },
            });
        } catch (error) {
            console.log(error);
            Swal.fire({
                title: "인증번호 전송 실패",
                text: "잘못된 전화번호이거나 오류가 발생했습니다",
                icon: "error",
                confirmButtonText: "확인",
                customClass: {
                    confirmButton: 'no-focus-outline'
                },
            });
        }
    }, [phoneNumber, appVerifier]);

    const handleVerifyCode = useCallback(async () => {
        if (!verificationCode) {
            Swal.fire({
                title: "인증번호 입력",
                text: "인증번호를 입력해주세요",
                icon: "warning",
                confirmButtonText: "확인",
                customClass: {
                    confirmButton: 'no-focus-outline'
                },
            });
            return;
        }

        if (!window.confirmationResult) {
            console.log("verification error");
            Swal.fire({
                title: "인증 실패",
                text: "인증에 오류가 발생했습니다",
                icon: "error",
                confirmButtonText: "확인",
                customClass: {
                    confirmButton: 'no-focus-outline'
                },
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
                confirmButtonText: "확인",
                customClass: {
                    confirmButton: 'no-focus-outline'
                },
            });
        }
    }, [verificationCode]);

    return (
        <div className="LoginContent">
            <LoginLogo />
            <LoginForm
                type={"tel"}
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                placeholder={"전화번호"}
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
            <div ref={recaptchaRef} />
        </div>
    );
};

export default React.memo(LoginContent);