import { useSpring, animated } from "react-spring";

const ImageLoading = ({ borderRadius }) => {
    const gradientAnimation = useSpring({
        from: { background: "linear-gradient(to right, #f6f6f6 0%, #f6f6f6 100%)" },
        to: { background: "linear-gradient(to right, lightgray 0%, #f6f6f6 100%)" },
        config: { duration: 1000 },
        loop: { reverse: true }
    });

    return (
        <animated.div
            className="ImageLoading"
            style={{
                ...gradientAnimation,
                position: "absolute",
                top: "0",
                left: "0",
                width: "100%",
                height: "100%",
                borderRadius: borderRadius,
            }}
        />
    );
};

export default ImageLoading;