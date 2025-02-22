import config from "config";
import moment from "moment";
import aws from "aws-sdk";
import Role from "@models/roles.model"
import { User } from "@interfaces/users.interface";
// import {Withoutid} from "@interfaces/users.interface"
import UserService from "@/services/users.service";
import { ServiceConfigurationOptions } from "aws-sdk/lib/service";
import { getMaxListeners } from "process";
import { Roles } from "@/interfaces/roles.interface"
import { Schema } from "mongoose";
import fs from 'fs'
import path from "path";
// import pdf from "pdf-creator-node"
import pdf from 'html-pdf'





class Helper {
	// role = Role
	userService = new UserService()
	async getSignedUrlAWS(
		fileName: any,
		signedUrlExpireSeconds: number = 60 * 60
	) {

		if (!fileName || (fileName && fileName.length === 0))
			return "";
		const serviceConfigOptions: ServiceConfigurationOptions = {
			region: config.get("awsS3.bucketRegion"),
			endpoint: new aws.Endpoint(config.get("awsS3.secretEntPoint")),
			accessKeyId: config.get("awsS3.accessKeyId"),
			secretAccessKey: config.get("awsS3.secretAccessKey"),
			signatureVersion: "v4",
		};
		const s3 = new aws.S3(serviceConfigOptions);
		const url = s3.getSignedUrl("getObject", {
			Bucket: config.get("awsS3.bucketName"),
			Key: fileName,
			Expires: signedUrlExpireSeconds,
		});
		return url;
	}


	async deleteObjectAWS(
		fileName: any,
	) {
		console.log('file receiving in delete object', fileName);
		const serviceConfigOptions: ServiceConfigurationOptions = {
			region: config.get("awsS3.bucketRegion"),
			endpoint: new aws.Endpoint(config.get("awsS3.secretEntPoint")),
			accessKeyId: config.get("awsS3.accessKeyId"),
			secretAccessKey: config.get("awsS3.secretAccessKey"),
			signatureVersion: "v4",
		};

		const s3 = new aws.S3(serviceConfigOptions);
		s3.deleteObject({
			Bucket: config.get("awsS3.bucketName"),
			Key: fileName
		}, (err, data) => {
			if (err) {
				console.log('error occured', err)

			} else {
				return true;
			}
		})
	}
	async generateHash() {
		var timestamp = ((new Date().getTime() / 1000) | 0).toString(16);
		return (
			timestamp +
			"xxxxxxxxxxxxxxxx"
				.replace(/[x]/g, function () {
					return ((Math.random() * 16) | 0).toString(16);
				})
				.toLowerCase()
		);
	}
	async generateOTP() {
		if (config.get("env") === "production") {
			return Math.floor(100000 + Math.random() * 900000);
		} else {
			return 123456;
		}
	}
	async sendSMS(to: string, message: string) {
		const accountSid = config.get("twilio.sid"),
			authToken = config.get("twilio.secret"),
			client = require("twilio")(accountSid, authToken);
		client.messages
			.create({
				body: message,
				from: config.get("twilio.phoneNumber"),
				to: to,
			})
			.then((message) => {
				//console.log(message.sid)
			});
	}
	async sendEmail(to: string, subject: string, content: any) {
		//to = `srvitality@yopmail.com`;
		const transporter = require("nodemailer").createTransport({
			host: config.get("mail.host"),
			port: config.get("mail.port"),
			auth: {
				user: config.get("mail.user"),
				pass: config.get("mail.pass"),
			},
			tls: {
				rejectUnauthorized: false,
			},
		});
		require("ejs").renderFile(
			"src/public/email-templates/index.ejs",
			content,
			function (err, data) {
				if (err) {
					return console.log(err);
				} else {
					content.content += `<p> For any kind of assistance, feel free to contact us at <a href="${config.get(
						"siteUrl"
					)}">${config.get("siteTitle")}</a>.</p>`;

					let mailOptions = {
						from:
							'"' +
							config.get("siteTitle") +
							' " <' +
							config.get("mail.from") +
							">",
						to: to,
						subject: subject,
						html: data
							.replace(/\%TITLE%/g, content.title)
							.replace(/\%CONTENT%/g, content.content)
							.replace(/\%SITE_URL%/g, config.get("siteUrl"))
							.replace(
								/\%SITE_EMAIL%/g,
								config.get("admin.email")
							)
							.replace(/\%SITE_TITLE%/g, config.get("siteTitle")),
					};
					transporter.sendMail(mailOptions, function (error, info) {
						if (error) {
							return console.log("Message not sent: " + error);
						}
						//console.log("Message sent: " + info.response);
					});
				}
			}
		);
	}
	async mailStaticTemplates(type: string, userData: any) {
		if (userData.email) {
			let title = null, content = null;
			switch (type) {
				case "reset-password":
					let reset_link: string = `${config.get(
						"siteUrl"
					)}/reset-password/${userData.resetToken}`;

					if (userData.role == "admin") {
						reset_link += `/admin`;
					}

					title = `Reset your login password`;
					content = `<p style="font-weight: 600; font-size: 18px; margin-bottom: 0;">Hey ${userData.name ? userData.name : userData.email
						}!</p>
                    <p class="sm-leading-32" style=""margin: 0 0 24px; font-weight: 400; font-size: 15px; margin: 0 0 16px; --text-opacity: 1; color: #263238; color: rgba(38, 50, 56, var(--text-opacity));">You just requested to reset your password.</p>
                    <p style="margin: 0 0 24px;">
                        Please reset your password by clicking the below link. If link is not working you may copy and paste below url in the browser to continue.
                        <br />
                        ${reset_link}
                    </p>
                    <p>
                        <a href="${reset_link}" style="display: block; font-weight: 600; font-size: 14px; line-height: 100%; padding: 16px 24px; --text-opacity: 1; color: #ffffff; color: rgba(255, 255, 255, var(--text-opacity)); text-decoration: none;">Reset Password Now →</a>
                    </p>
                    `;
					break;
				case "send-otp":
					title = `Account verification`;
					content = `<p style="font-weight: 600; font-size: 18px; margin: 0 0 24px;">Hey ${userData.name ? userData.name : userData.email
						}!</p>
                    
                    <p style="margin: 0 0 24px;">
                        <strong>${userData.otp}</strong> is your ${config.get(
							"siteTitle"
						)} account verification code. You can use this code only once and it will auto expire after 5 minutes if not used.
                    </p>`;
					break;
				case "signup-welcome":
					title = `Welcome ${userData.name ? userData.name : userData.email}`;
					content = `<p style="font-weight: 600; font-size: 18px; margin: 0 0 24px;">Hey ${userData.name ? userData.name : userData.email
						}!</p>
                    <p class="sm-leading-32" style="font-weight: 600; font-size: 20px; margin: 0 0 16px; --text-opacity: 1; color: #263238; color: rgba(38, 50, 56, var(--text-opacity));">
                        Thanks for signing up! 👋
                    </p>
                    <p style="margin: 0 0 24px;">
                        ${config.get(
							"siteTitle"
						)} welcomes you to join our creative community, start exploring the resources or showcasing your work.
                    </p>`;
					break;
				case "send-activationLink":
					let activation_link: String = `${config.get('siteUrl')}/api/admin/email/verified/${userData.token}`
					title = `Account verification`;

					content = `<p style="font-weight: 600; font-size: 18px; margin: 0 0 24px;">Hey ${userData.name ? userData.name : userData.email
						}!</p>
						
						<p style="margin: 0 0 24px;">
							<strong>${activation_link}</strong> is your ${config.get(
							"siteTitle"
						)} account verification link. You can use this l only once and it will auto expire after 5 minutes if not used.
						</p>`;
					break;
				default:
					break;
			}
			if (title && content) {
				await this.sendEmail(userData.email, title, {
					title,
					content,
				});
			}
		} else {
			console.log("email address not found to send email");
		}
	}
	async getTimeStops(minutes: number, start: string, end: string) {
		var startTime = moment(start, "hh:mm");
		var endTime = moment(end, "hh:mm");
		if (endTime.isBefore(startTime)) {
			endTime.add(1, "day");
		}
		var timeStops = [];
		while (startTime <= endTime) {
			timeStops.push(moment(startTime).format("hh:mm A"));
			startTime.add(minutes, "minutes");
		}
		return timeStops;
	}
	async userObj(findUser: any) {
		const user: any = {
			_id: findUser._id,
			name: findUser.name ? findUser.name : "",
			role: findUser.role,
			email: findUser.email,
			mobile: findUser.mobile ? findUser.mobile : "",
			profileImage: findUser.profileImage,
			dob: findUser.dob ? findUser.dob : "",
			location: findUser.location ? findUser.location : {},
			profileApproval: findUser.profileApproval ? findUser.profileApproval : {},
		};
		return user;
	}


	async defaultEntry() {

		const user = await this.userService.findUserByRole('admin')
		// console.log(user)

		type WithoutId = Omit<User, '_id' | "token" | "forEach">;
		if (!user) {
			const admin: WithoutId = ({
				name: config.get("admin.name"),
				mobile: config.get("admin.mobile"),
				email: config.get("admin.email"),
				role: [{ slug: config.get("admin.role") }],
				password: config.get("admin.password"),
				status: true,
				emailVarification: true,
				mobileVarification: true

			})


			const defaultAdmin = this.userService.createUser(admin)


		}



	}


	async createPdf(user: User) {
		console.log('hi')
		var html = fs.readFileSync('./src/public/welcomeTemplates/offerLatter.html', 'utf8');
		// var options = { format: 'Letter' };
		const update = html.replace(/\%NAME%/g,`${user.name}`)
		var options = {
				format: "A3",
				orientation: "portrait",
				border: "10mm",
				header: {
					height: "45mm",
					contents: '<div style="text-align: center;"></div>'
				},
				footer: {
					height: "28mm",
					contents: {
						first: 'Cover page',
						2: 'Second page', // Any page number is working. 1-based index
						default: '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>', // fallback value
						last: 'Last Page'
					}
				}
			}

		pdf.create(update,options).toFile(`./${user.name}.pdf`, function (err, res) {
			if (err) return console.log(err);
			console.log(res); // { filename: '/app/businesscard.pdf' }
		})
		// let html = fs.readFileSync('./src/public/welcomeTemplates/form.html', "utf-8")
		// // let newValue = html.replace(/userName/gi,`${user.name}`)
		// // const update= fs.writeFileSync(`./src/public/welcomeTemplates/form.html`, newValue)
		// var options = {
		// 	format: "A3",
		// 	orientation: "portrait",
		// 	border: "10mm",
		// 	header: {
		// 		height: "45mm",
		// 		contents: '<div style="text-align: center;"></div>'
		// 	},
		// 	footer: {
		// 		height: "28mm",
		// 		contents: {
		// 			first: 'Cover page',
		// 			2: 'Second page', // Any page number is working. 1-based index
		// 			default: '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>', // fallback value
		// 			last: 'Last Page'
		// 		}
		// 	}
		// };
		// // var name = user.name
		// var document = {
		// 	html: html.replace(/\%TITLE%/g,user.name),
		// 	// name:user.name,
		// 	path: "./output.pdf",
		// };
		// pdf.create(document, options)
		// .then((res) => {
		// 	console.log(res);
		// })
		// .catch((error) => {
		// 	console.error(error);
		// });

	}

	// async updateFile(user:User){
	// 	const copy= await fs.copyFile('./src/public/file/offerlatter.txt',`./src/public/file/welcome/${user.name}.txt`,(err)=>{
	// 		console.log(err)
	// 	})

	// 	const file= fs.readFileSync(`./src/public/file/welcome/${user.name}.txt`)
	// 	const fileToString= file.toString()
	// 	let newValue = fileToString.replace(/userName/gi,`${user.name}`)
	// 	const update= fs.writeFileSync(`./src/public/file/welcome/${user.name}.txt`, newValue)
	// }

}
export default new Helper();
