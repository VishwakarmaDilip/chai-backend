import mongoose from "mongoose"
import { User } from "../models/user.model.js"
import { Video } from "../models/video.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js"


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
                "totalPages": Math.ceil(totalVideos / limitNumber)
            },
            "All Videos Fetched"
        )
    )
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body
    // TODO: get video, upload to cloudinary, create video


    // Get owner details
    const owner = await User.findById(req.user._id).select("fullName")

    if (!owner) {
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
    if (!videoFile?.url || !thumbnail?.url) {
        throw new ApiError(401, "Failed to upload video or thumbnail")
    }


    // get video duration
    const duration = videoFile.duration ? videoFile.duration.toFixed(2) : "0"


    // create video object - entry in db
    const createdVideo = await Video.create({
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        title,
        description,
        duration,
        owner: owner._id
    })


    //check for video creation

    if (!createdVideo) {
        throw new ApiError(500, "something went wrong while uploading video")
    }


    // return response
    return res
        .status(200)
        .json(
            new ApiResponse(200, {
                createdVideo,
                uploadedBy: owner.fullName
            }, "Video Uploaded Successfully")
        )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const userId = req.user._id
    //TODO: get video by id

    // fetch video detail
    const getVideo = await Video.findById(videoId)
    if (!getVideo) {
        throw new ApiError(404, "Video Not Found")
    }

    // fetch User
    const user = await User.findById(userId)

    // update watch History Detail
    const existingHistoryIndex = user.watchHistory.findIndex(item => item.videoId.toString() === videoId)

    if (existingHistoryIndex !== -1) {
        // if the video is already in watch history, update the watchAt timestamp
        user.watchHistory[existingHistoryIndex].watchedAt = new Date()
    } else {
        // if the video is not in history, add a new entry
        user.watchHistory.push({
            videoId,
            title: getVideo.title,
            thumbnail: getVideo.thumbnail,
            watchedAt: new Date(),
            duration: getVideo.duration,
            progress: 0

        })
    }

    // save updated user data
    await user.save()

    return res.status(200)
        .json(
            new ApiResponse(
                200,
                getVideo,
                "Video fetched successfully"
            )
        )

})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

    // get update values
    const { title, description } = req.body
    const video = await Video.findById(videoId)
    const oldThumbnailURL = video.thumbnail

    const thumbnailLocalPath = req.file?.path


    // get thumbnail URL
    let thumbnail
    let newThumbnailUrl
    if (thumbnailLocalPath) {
        thumbnail = await uploadOnCloudinary(thumbnailLocalPath)
        if (!thumbnail.url) {
            throw new ApiError(
                400,
                "something went wrong while uploading thumbnail"
            )
        }
        newThumbnailUrl = thumbnail.url
        await deleteFromCloudinary(oldThumbnailURL)
    } else {
        newThumbnailUrl = oldThumbnailURL
    }


    // update On DB
    const updatedDetail = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                thumbnail: newThumbnailUrl,
                title,
                description
            }
        },
        {
            new: true
        }
    )


    return res.status(200)
        .json(
            new ApiResponse(
                200,
                updatedDetail,
                "Video fetched successfully"
            )
        )

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video

    // find video and delete from DB
    const video = await Video.findByIdAndDelete(videoId)
    const videoURL = video.videoFile
    const thumbnailURL = video.thumbnail

    // delete from cloudinary
    await deleteFromCloudinary(videoURL)
    await deleteFromCloudinary(thumbnailURL)

    // return response
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                video,
                "Video Deleted Successfully"
            )
        )

})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    // ✅ Validate videoId
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // ✅ Find the video
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // ✅ Toggle publish status
    video.isPublished = !video.isPublished;

    // ✅ Save updated status
    await video.save();

    // ✅ Return response
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    videoId: video._id,
                    isPublished: video.isPublished
                },
                `Video ${video.isPublished ? "published" : "unpublished"} successfully`)
        );
})


export {
    publishAVideo,
    getAllVideos,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}