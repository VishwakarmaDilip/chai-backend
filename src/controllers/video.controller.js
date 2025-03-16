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

    // convert page and limi to Numbers
    const pageNumber = parseInt(page, 10)
    const limitNumber = parseInt(limit, 10)

    const skip = (pageNumber - 1) * limitNumber


    // get short order ascending or descending
    const sortOrder = sortType === "dsc" ? -1 : 1


    // build match filter
    const queryObject = {}
    if (query) {
        queryObject.$or = [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
        ]
    }

    if (userId) {
        const byUser = await User.aggregate([
            {
                $match: {
                    username: userId?.toLowerCase()
                }
            },
            {
                $project: {
                    _id: 1
                }
            }
        ])

        queryObject.owner = new mongoose.Types.ObjectId(byUser[0]._id)
    }


    // Get all video
    const totalVideos = await Video.countDocuments(queryObject)

    const allVideos = await Video.aggregate([
        {
            $match: queryObject
        },
        {
            $sort: {
                [sortBy]: sortOrder
            }
        },
        {
            $skip: skip,
        },
        {
            $limit: limitNumber
        }
    ])


    return res.status(200).json(
        new ApiResponse(
            200,
            {
                allVideos,
                "page": pageNumber,
                "limit": limitNumber,
                totalVideos,
                "totalPages": Math.ceil(totalVideos/ limitNumber)
            },
            "All Videos Fetched"
        )
    )
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    // TODO: get video, upload to cloudinary, create video


    // Get owner details
    const owner = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $project: {
                fullName: 1
            }
        }
    ])

    if (!owner.length) {
        throw new ApiError(404, "Owner not found")
    }


    // validate not empty
    if (
        [title, description].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "title and description is required")
    }


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
    const uploadedBy = owner[0].fullName

    if (!createdVideoId) {
        throw new ApiError(500, "something went wrong while uploading video")
    }


    // return response
    return res
        .status(200)
        .json(
            new ApiResponse(200, {
                createdVideoId,
                uploadedBy
            }, "Video Uploaded Successfully")
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
    publishAVideo,
    getAllVideos
}