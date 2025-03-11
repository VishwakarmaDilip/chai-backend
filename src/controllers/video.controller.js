import mongoose from "mongoose"
import { User } from "../models/user.model.js"
import { Video } from "../models/video.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination

})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    // TODO: get video, upload to cloudinary, create video


    // Get owner details
    const owner = await Video.aggregate([
        {
            $lookup: {
                from: "User",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        {
            $unwind: "$owner"
        },
        {
            $project: {
                title: 1,
                "owner.fullName": 1
            }
        }
    ])
    console.log(owner);

    if (!owner.length) {
        throw new ApiError(404, "Owner not found")
    }


    // validate not empty
    if (
        [title, description].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "title and description is required")
    }

    // console.log(title,description);
    // console.log("aa gaya");

    // check for video and thumbnail
    const videoFileLocalPath = req.files?.videoFile[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path

    if (!videoFileLocalPath || !thumbnailLocalPath) {
        throw new ApiError(400, "Video file and thumbnail are required")
    }

    // upload them to cloudinary
    const videoFile = await uploadOnCloudinary(videoFileLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)


    // check upload
    if (!videoFile || !thumbnail) {
        throw new ApiError(401, "Failed to upload video file or thumbnail")
    }


    // get video duration
    const duration = videoFile.duration

    console.log("duration:", duration);



    // create video object - entry in db
    const video = await Video.create({
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        title,
        description,
        duration: duration.toFixed(2),
        owner: owner[0]
    })


    //check for videoid creation
    const createdVideoId = await Video.findById(video._id)

    if (!createdVideoId) {
        throw new ApiError(500, "something went wrong while uploading video")
    }


    // return response
    return res
        .status(200)
        .json(
            new ApiResponse(200, createdVideoId, "Video Uploaded Successfully")
        )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})


export {
    publishAVideo
}