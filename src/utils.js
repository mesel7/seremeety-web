import { faHeart as faHeartSolid, faEnvelope as faEnvelopeSolid, faComment as faCommentSolid, faUser as faUserSolid, faMusic, faGear, faPaperPlane, faAngleLeft, faCakeCandles, faLocationArrow, faAngleRight, faPhone, faHashtag, faBars, faMagnifyingGlass, faMars, faVenus, faGraduationCap, faCircleInfo, faSliders } from "@fortawesome/free-solid-svg-icons";
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { auth, db, storage } from "./firebase";
import { faHeart as faHeartRegular, faEnvelope as faEnvelopeRegular, faComment as faCommentRegular, faUser as faUserRegular, faCircleCheck, faCircleXmark, faCircleQuestion } from "@fortawesome/free-regular-svg-icons";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import imageCompression from "browser-image-compression";
import { universityList } from "./universities";
import { placeList } from "./places";

export const menuItem = [
    {
        icon: faHeartRegular,
        color: "gray",
        selectedIcon: faHeartSolid,
        selectedColor: "#92a8d1",
        dataRoute: "/matching"
    },
    {
        icon: faEnvelopeRegular,
        color: "gray",
        selectedIcon: faEnvelopeSolid,
        selectedColor: "#92a8d1",
        dataRoute: "/request"
    },
    {
        icon: faCommentRegular,
        color: "gray",
        selectedIcon: faCommentSolid,
        selectedColor: "#92a8d1",
        dataRoute: "/chat"
    },
    {
        icon: faUserRegular,
        color: "gray",
        selectedIcon: faUserSolid,
        selectedColor: "#92a8d1",
        dataRoute: "/mypage"
    }
];

export const icons = {
    faPhone,
    faHashtag,
    faMusic,
    faGear,
    faPaperPlane,
    faCircleQuestion,
    faCircleCheck,
    faCircleXmark,
    faAngleLeft,
    faAngleRight,
    faCakeCandles,
    faLocationArrow,
    faHeartSolid,
    faBars,
    faMagnifyingGlass,
    faMars,
    faVenus,
    faGraduationCap,
    faCircleInfo,
    faUserSolid,
    faSliders
};

export const mypageForm = [
    {
        field: "닉네임",
        type: "text",
        id: "nickname"
    },
    {
        field: "나이",
        type: "date",
        id: "birthdate"
    },
    {
        field: "성별",
        type: "radio",
        id: "gender",
        options: ["male", "female"]
    },
    {
        field: "MBTI",
        type: "select",
        id: "mbti",
        options: [
            "ISTJ", "ISFJ", "INFJ", "INTJ", 
            "ISTP", "ISFP", "INFP", "INTP",
            "ESTP", "ESFP", "ENFP", "ENTP",
            "ESTJ", "ESFJ", "ENFJ", "ENTJ"
        ]
    },
    {
        field: "학교",
        type: "select",
        id: "university",
        options: universityList
    },
    {
        field: "지역",
        type: "select",
        id: "place",
        options: placeList
    },
    {
        field: "자기소개",
        type: "textarea",
        id: "introduce"
    }
];

export const validationRules = {
    nickname: async (value) => {
        if (!/^[a-zA-Z0-9가-힣]{1,6}$/.test(value)) {
            return "6자리 이하의 한글, 영문, 숫자 닉네임만 가능해요";
        }
        const isDuplicate = await checkNicknameDuplicate(value);
        if (!isDuplicate) {
            return '이미 사용 중인 닉네임이에요';
        }
        return true;
    },
    age: (value) => {
        if (!value) {
            return "생년월일을 입력해주세요";
        }
        const age = parseInt(value.match(/\d+/)[0], 10);
        if (age < 18) {
            return "유효한 생년월일을 입력해주세요";
        }
        return true;
    },
    gender: (value) => value ? true : "성별을 선택해 주세요",
    mbti: (value) => value ? true : "MBTI를 선택해 주세요",
    university: (value) => value ? true : "학교를 입력해 주세요",
    place: (value) => value ? true : "지역을 입력해 주세요",
    introduce: (value) => {
        if (!value) {
            return "자기소개를 작성해 주세요";
        } else if (value.length > 500) {
            return "자기소개는 최대 500자까지 작성할 수 있어요";
        }
        return true;
    }
};

export const settingItem = [
    {
        content: "알림 설정",
        onClick: () => console.log("알림 설정")
    },
    {
        content: "아는 사람 피하기",
        onClick: () => console.log("아는 사람 피하기")
    },
    {
        content: "이용약관",
        onClick: () => console.log("이용약관")
    },
    {
        content: "문의하기",
        onClick: () => console.log("문의하기")
    },
    {
        content: "로그아웃",
        onClick: () => {
            auth.signOut();
            window.location.reload();
        }
    }
];

export const shopItem = [
    {
        quantity: 15,
        discount: "",
        price: 3000
    },
    {
        quantity: 55,
        discount: "10",
        price: 9900
    },
    {
        quantity: 115,
        discount: "20",
        price: 18400
    },
    {
        quantity: 355,
        discount: "30",
        price: 49700
    }
];

export const toLocalePhoneNumber = (input) => {
    const cleanText = input.replace(/-/g, "");
    const MAX_LENGTH = 11;
    const FIRST_HYPHEN_INDEX = 3;
    const SECOND_HYPHEN_INDEX = 7;

    let localePhoneNumber = cleanText.slice(0, MAX_LENGTH);

    if (localePhoneNumber.length > SECOND_HYPHEN_INDEX) {
        localePhoneNumber = localePhoneNumber.slice(0, SECOND_HYPHEN_INDEX) +
        "-" +
        localePhoneNumber.slice(SECOND_HYPHEN_INDEX);
    }
    if (localePhoneNumber.length > FIRST_HYPHEN_INDEX) {
        localePhoneNumber = localePhoneNumber.slice(0, FIRST_HYPHEN_INDEX) +
        "-" +
        localePhoneNumber.slice(FIRST_HYPHEN_INDEX);
    }

    return localePhoneNumber;
};

export const toIntlPhoneNumber = (input) => {
    let intlPhoneNumber = input.replace(/-/g, "");
    if (intlPhoneNumber.length > 0 && intlPhoneNumber[0] === "0") {
        intlPhoneNumber = "+82" + intlPhoneNumber.substring(1);
    } else {
        intlPhoneNumber = "+82" + intlPhoneNumber;
    }

    return intlPhoneNumber;
}

export const getAgeByBirthDate = (birthdate) => {
    const today = new Date();
    const dateOfBirth = new Date(birthdate);
    
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const todayMonthDay = today.getMonth() * 100 + today.getDate();
    const birthMonthDay = dateOfBirth.getMonth() * 100 + dateOfBirth.getDate();
    if (todayMonthDay < birthMonthDay) {
        age -= 1;
    }

    return age;
};

export const formatTimeStampForList = (timestamp) => {
    let date;
    if (timestamp instanceof Date) {
        date = timestamp;
    } else if (timestamp && timestamp.seconds){
        date = new Date(timestamp.seconds * 1000);
    } else {
        console.log("invalid timestamp");
        return " ";
    }

    const now = new Date();
    const isSameYear = date.getFullYear() === now.getFullYear();
    const isSameDay = date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
    const isYesterday = date.getMonth() === now.getMonth() && now.getDate() - date.getDate() === 1;

    if (!isSameYear) {
        return date.toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    }

    if (isSameDay) {
        return date.toLocaleString("ko-KR", { hour: "numeric", minute: "numeric", hour12: true });
    } else if (isYesterday) {
        return "어제";
    } else {
        return date.toLocaleString("ko-KR", { month: "long", day: "numeric" });
    }
}

export const formatTimeStampForMessage = (timestamp) => {
    let date;
    if (timestamp instanceof Date) {
        date = timestamp;
    } else if (timestamp && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        console.log("invalid timestamp");
        return " ";
    }

    const now = new Date();
    const isSameYear = date.getFullYear() === now.getFullYear();
    const isSameDay = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();

    if (isSameDay) {
        return date.toLocaleString("ko-KR", { hour: "numeric", minute: "numeric", hour12: true });
    } 

    const timePart = date.toLocaleString("ko-KR", { hour: "numeric", minute: "numeric", hour12: true });

    if (isYesterday) {
        return `어제 ${timePart}`;
    } 
    
    const datePart = date.toLocaleString("ko-KR", {
        month: "long",
        day: "numeric",
    });

    if (!isSameYear) {
        const yearPart = `${String(date.getFullYear()).slice(2)}년`;
        return `${yearPart} ${datePart} ${timePart}`;
    }

    return `${datePart} ${timePart}`;
};

export const checkNicknameDuplicate = async (value) => {
    const userSnapshot = await getDocs(collection(db, "users"));
    for (const userDoc of userSnapshot.docs) {
        const uid = userDoc.id;
        const userData = userDoc.data();

        if (uid !== auth.currentUser.uid && value === userData.nickname) {
            return false;
        }
    }

    return true;
};

export const getUserDataByUid = async (uid) => {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        console.log("user data not found");
        return null;
    }
};

export const setNewUserData = async (user) => {
    const usersRef = collection(db, "users");
    await setDoc(doc(usersRef, user.uid), {
        age: "",
        birthdate: "",
        coin: 0,
        createdAt: serverTimestamp(),
        gender: "",
        introduce: "",
        mbti: "",
        nickname: "",
        phone: user.phoneNumber,
        place: "",
        profilePictureUrl: "https://firebasestorage.googleapis.com/v0/b/seremeety-web.appspot.com/o/img_default_profile.png?alt=media&token=d11a843f-1611-4f8f-be26-c7438842fd29",
        profileStatus: 0,
        university: 0
    });
}

export const compressImage = async (file) => {
    return await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true
    });
};

export const dataURLToFile = (dataURL, filename) => {
    const [header, data] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(data);
    const array = [];
    for (let i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
    }
    return new File([new Uint8Array(array)], filename, { type: mime });
};

export const uploadImageToStorage = (file, uid) => {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, `/profile_pictures/${uid}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
            "state_changed",
            null,
            (error) => reject(error),
            async () => {
                try {
                    resolve(await getDownloadURL(uploadTask.snapshot.ref));
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
};

export const updateUserDataByUid = async (uid, data) => {
    const usersRef = collection(db, "users");
    await updateDoc(doc(usersRef, uid), data);
};

export const getUserProfiles = async (currentUserData) => {
    const queryConstraints = [
        where("profileStatus", "==", 1)
    ];
    if (currentUserData["gender"]) {
        queryConstraints.push(
            where("gender", "==", currentUserData["gender"] === "male" ? "female" : "male")
        );
    }

    const querySnapshot = await getDocs(query(collection(db, "users"), ...queryConstraints));
    const userProfiles = querySnapshot.docs.map((doc) => (
        {
            ...doc.data(),
            uid: doc.id
        }
    ));
    return userProfiles;
};

export const getRequests = async (uid) => {
    const [receivedSnapshot, sentSnapshot] = await Promise.all([
        getDocs(query(collection(db, "requests"), where("to", "==", uid))),
        getDocs(query(collection(db, "requests"), where("from", "==", uid)))
    ]);

    const receivedRequests = receivedSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    const sentRequests = sentSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));

    return { receivedRequests, sentRequests };
};

export const isRequestExist = async (currentUserUid, otherUserUid) => {
    const receivedQueryConstraints = [
        where("to", "==", currentUserUid),
        where("from", "==", otherUserUid)
    ];

    const receivedSnapshot = await getDocs(query(collection(db, "requests"), ...receivedQueryConstraints));
    if (!receivedSnapshot.empty) {
        return true;
    }

    const sentQueryConstraints = [
        where("from", "==", currentUserUid),
        where("to", "==", otherUserUid)
    ];

    const sentSnapshot = await getDocs(query(collection(db, "requests"), ...sentQueryConstraints));
    if (!sentSnapshot.empty) {
        return true;
    }

    return false;
};

export const createRequest = async (newRequest) => {
    const requestsRef = collection(db, "requests");
    const docRef = await addDoc(requestsRef, newRequest);
    return docRef.id;
};

export const updateRequestById = async (requestId, data) => {
    const requestsRef = collection(db, "requests");
    await updateDoc(doc(requestsRef, requestId), data);
};

export const getChatRooms = async (uid) => {
    const querySnapshot = await getDocs(query(collection(db, "chat_rooms"), where("users", "array-contains", uid)));
    const chatRooms = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return chatRooms;
};

export const subscribeToChatRooms = (dispatch) => {
    console.log("subscribe to chat rooms");
    const chatRoomRef = collection(db, "chat_rooms");
    const q = query(
        chatRoomRef,
        where("users", "array-contains", auth.currentUser.uid),
        orderBy("lastMessage.sentAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const chatRooms = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        dispatch({
            type: "INIT",
            data: chatRooms
        });
    });

    return unsubscribe;
};

export const createChatRoom = async (newChatRoom) => {
    const chatRoomsRef = collection(db, "chat_rooms");
    const docRef = await addDoc(chatRoomsRef, newChatRoom);
    return docRef.id;
};

export const getChatRoomById = async (chatRoomId) => {
    const docRef = doc(db, "chat_rooms", chatRoomId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docSnap.data();
    } else {
        console.log("chat room not found");
        return null;
    }
}

export const getChatRoomMessages = async (chatRoomId) => {
    const messagesRef = collection(db, "chat_rooms", chatRoomId, "messages");
    const querySnapshot = await getDocs(messagesRef);
    const messages = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return messages;
};

export const subscribeToChatRoomMessages = (chatRoomId, setChatRoomMessages) => {
    console.log("subscribe to chat room messages");
    const messagesRef = collection(db, "chat_rooms", chatRoomId, "messages");
    
    const unsubscribe = onSnapshot(query(messagesRef, orderBy("sentAt", "asc")), (snapshot) => {
        const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setChatRoomMessages(messages);
    });

    return unsubscribe;
}

export const createMessage = async (chatRoomId, newMessageData) => {
    await addDoc(collection(db, "chat_rooms", chatRoomId, "messages"), newMessageData);

    const chatRoomRef = doc(db, "chat_rooms", chatRoomId);
    await updateDoc(chatRoomRef, { lastMessage: { text: newMessageData.text, sentAt: newMessageData.sentAt }});
};