import { Kafka } from "kafkajs";
import nodemailer from "nodemailer";
import dotenv from "dotenv"
dotenv.config();

export const startSendMailConsumer = async () => {
  try {
        const kafka = new Kafka({
        clientId: "mail-service",
        brokers: [process.env.KAFKA_BROKERS || "localhost:9092"],
        });

    const consumer = kafka.consumer({
      groupId: "mail-service-group",
    });

    await consumer.connect();

    const topic = "send-mail";

    await consumer.subscribe({
      topic,
      fromBeginning: false,
    });

    console.log("Kafka consumer connected");

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const { to, sub, html } = JSON.parse(
            message.value?.toString() || "{}"
          );

          const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
              user: process.env.MAIL_USER,
              pass: process.env.MAIL_PASSWORD,
            },
          });

          await transporter.sendMail({
            from: `Job Portal <${process.env.MAIL_USER}>`,
            to,
            subject: sub,
            html,
          });

          console.log(`Mail sent to ${to}`);
        } catch (error) {
          console.error("Error processing mail:", error);
        }
      },
    });
  } catch (error) {
    console.error("Kafka consumer error:", error);
  }
};