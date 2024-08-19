import { faEnvelope, faHeart, faMessage, faUser, faMusic, faGear } from "@fortawesome/free-solid-svg-icons";
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { auth, db } from "./firebase";

export const menuItem = [
    {
        icon: faHeart,
        color: "white",
        selectedColor: "#ececec",
        dataRoute: "/matching"
    },
    {
        icon: faEnvelope,
        color: "white",
        selectedColor: "#ececec",
        dataRoute: "/request"
    },
    {
        icon: faMessage,
        color: "white",
        selectedColor: "#ececec",
        dataRoute: "/chat"
    },
    {
        icon: faUser,
        color: "white",
        selectedColor: "ececec",
        dataRoute: "/mypage"
    }
];

export const icons = {
    faMusic,
    faGear
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
        type: "text",
        id: "university"
    },
    {
        field: "지역",
        type: "text",
        id: "place"
    },
    {
        field: "소개 한 마디",
        type: "textarea",
        id: "introduce"
    }
];

export const profileInfo = [
    {
        field: "닉네임",
        id: "nickname"
    },
    {
        field: "나이",
        id: "age"
    },
    {
        field: "성별",
        id: "gender"
    },
    {
        field: "MBTI",
        id: "mbti"
    },
    {
        field: "학교",
        id: "university"
    },
    {
        field: "지역",
        id: "place"
    },
    {
        field: "소개 한 마디",
        id: "introduce"
    }
];

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
        return "Invalid Date";
    }

    const now = new Date();
    const options = {
        month: "long",
        day: "numeric"
    };

    if (date.getFullYear() !== now.getFullYear()) {
        options.year = "numeric";
    }

    return date.toLocaleString("ko-KR", options);
}

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

