import React, { useEffect, useReducer } from "react"
import { createRequest, getRequests, updateRequestById } from "../utils";
import { auth } from "../firebase";
import { serverTimestamp } from "firebase/firestore";

export const RequestStateContext = React.createContext();
export const RequestDispatchContext = React.createContext();

const reducer = (state, action) => {
    switch (action.type) {
        case "INIT": return action.data;
        case "CREATE": return action.data;
        case "UPDATE": return action.data;
        default: return state;
    }
};

export const RequestProvider = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, { receivedRequests: [], sentRequests: [] });

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const requests = await getRequests(auth.currentUser.uid);
                dispatch({
                    type: "INIT",
                    data: {
                        receivedRequests: requests.receivedRequests.sort((a, b) => b.createdAt - a.createdAt),
                        sentRequests: requests.sentRequests.sort((a, b) => b.createdAt - a.createdAt)
                    }
                });
                console.log("requests fetched");
            } catch (error) {
                console.log(error);
            }
        };

        fetchRequests();
    }, []);

    const onCreate = async (currentUserUid, otherUserUid) => {
        const newRequest = {
            createdAt: new Date(),
            from: currentUserUid,
            status: "pending",
            to: otherUserUid
        };

        try {
            const newRequestId = await createRequest({
                ...newRequest,
                createdAt: serverTimestamp()
            });

            dispatch({
                type: "CREATE",
                data: {
                    ...state,
                    sentRequests: [
                        ...state.sentRequests,
                        { ...newRequest, id: newRequestId }
                    ].sort((a, b) => b.createdAt - a.createdAt)
                }
            });
        } catch (error) {
            console.log(error);
        }
    };

    const onUpdate = async (requestId, updatedRequest) => {
        try {
            await updateRequestById(requestId, updatedRequest);
            dispatch({
                type: "UPDATE",
                data: {
                    ...state,
                    receivedRequests: state.receivedRequests.map((it) => (
                        it.id === requestId ? { ...updatedRequest, id: requestId } : it
                    ))
                }
            });
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <RequestStateContext.Provider value={state}>
            <RequestDispatchContext.Provider value={{ onCreate, onUpdate }}>
                {children}
            </RequestDispatchContext.Provider>
        </RequestStateContext.Provider>
    );
};