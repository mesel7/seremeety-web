import React, { useEffect, useReducer } from "react";
import { createChatRoom, createMessage, subscribeToChatRooms } from "../utils";
import { auth } from "../firebase";
import { serverTimestamp } from "firebase/firestore";

export const ChatStateContext = React.createContext();
export const ChatDispatchContext = React.createContext();

const reducer = (state, action) => {
    switch (action.type) {
        case "INIT": return action.data;
        case "CREATE": return action.data;
        case "UPDATE": return action.data;
        default: return state;
    }
};

export const ChatProvider = ({ children, enableSubscription = true }) => {
    const [state, dispatch] = useReducer(reducer, []);

    useEffect(() => {
        let unsubscribe;
        if (enableSubscription) {
            unsubscribe = subscribeToChatRooms(dispatch);
        }

        return () => {
            if (unsubscribe) {
                console.log("unsubscribe to chat rooms");
                unsubscribe();
            }
        };
    }, [enableSubscription]);

    const onCreate = async (currentUserUid, otherUserUid) => {
        const now = new Date();
        const newChatRoom = {
            createdAt: now,
            lastMessage: { sentAt: now, text: "" },
            users: [currentUserUid, otherUserUid]
        };

        try {
            const newChatRoomId = await createChatRoom({
                ...newChatRoom,
                createdAt: serverTimestamp(),
                lastMessage: { sentAt: serverTimestamp(), text: "" }
            });

            dispatch({
                type: "CREATE",
                data: [
                    ...state,
                    { ...newChatRoom, id: newChatRoomId }
                ].sort((a, b) => b.lastMessage.sentAt - a.lastMessage.sentAt)
            });
        } catch (error) {
            console.log(error);
        }
    };

    const onUpdate = async (text, chatRoomId) => {
        const newMessageData = {
            sender: auth.currentUser.uid,
            sentAt: new Date(),
            text
        };

        try {
            await createMessage(chatRoomId,
                { ...newMessageData, sentAt: serverTimestamp() }
            );

            const updatedChatRooms = state.map((it) => 
                it.id === chatRoomId ?
                { ...it, lastMessage: { text, sentAt: newMessageData.sentAt } } :
                it
            ).sort((a, b) => b.lastMessage.sentAt - a.lastMessage.sentAt);

            dispatch({
                type: "UPDATE",
                data: updatedChatRooms
            });
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <ChatStateContext.Provider value={state}>
            <ChatDispatchContext.Provider value={{ onCreate, onUpdate }}>
                {children}
            </ChatDispatchContext.Provider>
        </ChatStateContext.Provider>
    );
};