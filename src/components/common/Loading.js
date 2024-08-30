import { FadeLoader } from "react-spinners";
import "./Loading.css";

const Loading = ({ containerSize }) => {
    return (
        <div className={["loading_container", `loading_container_${containerSize}`].join(" ")}>
            <FadeLoader size={50} color={"lightgray"} loading={true} />
        </div>
    );
};

export default Loading;