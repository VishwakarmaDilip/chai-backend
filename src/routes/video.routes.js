import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import {
    deleteVideo,
    getAllVideos,
    getVideoById,
    publishAVideo,
    updateVideo
} from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router
    .route("/upload")
    .post(
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1
            },
            {
                name: "thumbnail",
                maxCount: 1
            }
        ]),
        publishAVideo
    )

router.route("/getAllVideos").get(getAllVideos)

router.route("/video/:videoId").get(getVideoById)

router.route("/updateDetail/:videoId").patch(upload.single("thumbnail"), updateVideo)

router.route("/video/:videoId").delete(deleteVideo)


export default (router)