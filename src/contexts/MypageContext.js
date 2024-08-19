import React, { useEffect, useReducer } from "react";
import { getUserDataByUid, updateUserDataByUid } from "../utils";
import { auth } from "../firebase";
import Swal from "sweetalert2";

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
        try {
            await updateUserDataByUid(auth.currentUser.uid, newData);
            dispatch({
                type: "UPDATE",
                data: { ...newData }
            });

            Swal.fire({
                title: "프로필 저장",
                text: "성공적으로 저장되었습니다!",
                icon: "success",
                confirmButtonText: "확인"
            });
        } catch (error) {
            console.log(error);
            Swal.fire({
                title: "프로필 저장 실패",
                text: "오류가 발생했습니다",
                icon: "error",
                confirmButtonText: "확인"
            });
        }
    };

    return (
        <MypageStateContext.Provider value={state}>
            <MypageDispatchContext.Provider value={{ onUpdate }}>
                {children}
            </MypageDispatchContext.Provider>
        </MypageStateContext.Provider>
    );
};