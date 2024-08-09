import React, { useEffect, useReducer } from "react";
import { getUserDataByUid, getUserProfiles } from "../utils";
import { auth } from "../firebase";

export const MatchingStateContext = React.createContext();

const reducer = (state, action) => {
    switch (action.type) {
        case "INIT": return action.data;
        default: return state;
    }
};

export const MatchingProvider = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, []);

    useEffect(() => {
        const fetchUserProfiles = async () => {
            try {
                const currentUserData = await getUserDataByUid(auth.currentUser.uid);
                const userProfiles = await getUserProfiles(currentUserData);
                dispatch({ type: "INIT", data: userProfiles });
                console.log("user profiles fetched");
            } catch (error) {
                console.log(error);
            }
        };

        fetchUserProfiles();
    }, []);

    return (
        <MatchingStateContext.Provider value={state}>
            {children}
        </MatchingStateContext.Provider>
    );
};