import React, { useEffect, useReducer, useState } from "react";
import { dataURLToFile, getUserDataByUid, updateUserDataByUid, uploadImageToStorage } from "../utils";
import { auth } from "../firebase";
import Swal from "sweetalert2";
import Loading from "../components/common/Loading";

export const MypageStateContext = React.createContext();
export const MypageDispatchContext = React.createContext();

const reducer = (state, action) => {
    switch (action.type) {
        case "INIT": return action.data;
        case "UPDATE": return action.data;
        default: return state;
    }
};

export const MypageProvider = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, {});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const userData = await getUserDataByUid(auth.currentUser.uid);
                dispatch({ type: "INIT", data: userData });
                console.log("user data fetched");
            } catch (error) {
                console.log(error);
            }
        };

        fetchUserProfile();
    }, []);

    const onUpdate = async (newData) => {
        setIsLoading(true);
        try {
            if (newData.profilePictureUrl !== state.profilePictureUrl) {
                const file = dataURLToFile(newData.profilePictureUrl, "profile_picture.jpg");
                const uploadedUrl = await uploadImageToStorage(file, auth.currentUser.uid);
                newData.profilePictureUrl = uploadedUrl;
            }

            await updateUserDataByUid(auth.currentUser.uid, newData);
            dispatch({
                type: "UPDATE",
                data: { ...newData }
            });

            Swal.fire({
                title: "프로필 저장 성공",
                text: "성공적으로 저장되었습니다!",
                icon: "success",
                confirmButtonText: "확인",
                customClass: {
                    confirmButton: 'no-focus-outline'
                },
            });
        } catch (error) {
            console.log(error);
            Swal.fire({
                title: "프로필 저장 실패",
                text: "오류가 발생했습니다",
                icon: "error",
                confirmButtonText: "확인",
                customClass: {
                    confirmButton: 'no-focus-outline'
                },
            });
        } finally {
            setIsLoading(false);
        }
    };

    const onUpdateCoin = async (newData) => {
        try {
            await updateUserDataByUid(auth.currentUser.uid, newData);
            dispatch({
                type: "UPDATE",
                data: { ...newData }
            });
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <>
            {isLoading && <Loading />}
            <MypageStateContext.Provider value={state}>
                <MypageDispatchContext.Provider value={{ onUpdate, onUpdateCoin }}>
                    {children}
                </MypageDispatchContext.Provider>
            </MypageStateContext.Provider>
        </>
    );
};