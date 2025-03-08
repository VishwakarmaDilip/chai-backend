import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"



const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findOne(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "something went rong while generating refresh and access token")
    }
}


const registerUser = asyncHandler(async (req, res) => {
    //step 1: get user detail from frontend
    //step 2: validation - not empty
    //step 3: check if user already exists: username, email
    //step 4: check for images, check for avatar
    //step 5: upload them to cloudinary, avatar
    //step 6: create user object - create entry in db
    //step 7: remove password and refresh token field from response
    //step 8: check for user creation
    //step 9: return response



    //step 1: get user detail from frontend
    const { fullName, email, username, password } = req.body



    //step 2: validation - not empty
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "fullName is required")
    }


    //step 3: check if user already exists: username, email
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "user with email or username already exists")
    }


    //step 4: check for images, check for avatar
    const avartarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avartarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }


    //step 5: upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avartarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }


    //step 6: create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })



    //step 7: remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //step 8: check for user creation
    if (!createdUser) {
        throw new ApiError(500, "Somthing went wrong while registering the user")

    }


    //step 9: return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )


})

const loginUser = asyncHandler(async (req, res) => {
    //step 1: req.body -> data
    //step 2: username or email
    //step 3: find the user
    //step 4: passwoerd check
    //step 5: access and referesh token
    //step 6: send cookie


    //step 1: req.body -> data
    const { email, username, password } = req.body

    console.log(username);



    //step 2: username or email
    if (!(username || email)) {
        throw new ApiError(400, "username or email is required")
    }


    //step 3: find the user
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "user does not exist")

    }


    //step 4: passwoerd check
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")

    }


    //step 5: access and referesh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)


    //step 6: send cookie
    const loggedInUser = await User.findById(user._id).select("-password -reffreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }



    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User Logged In Successfully"
            )
        )



})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is Expired Or Used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access Token Refreshed"
                )
            )
    } catch (error) {
        throw ApiError(401, error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old Password")

    }

    user.password = newPassword

    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200, "Password changed successfully"))
})


export { registerUser, loginUser, logoutUser, refreshAccessToken }