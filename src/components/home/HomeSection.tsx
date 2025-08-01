"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Merriweather_Sans } from "next/font/google";
import { motion } from "framer-motion";
import { MapPin, ChevronDown, ChevronRight, Star, Map, Backpack } from "lucide-react";

const merriweatherSans = Merriweather_Sans({
  variable: "--font-merriweather-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
});

interface HomeSectionProps {
  onGuideClick: () => void;
  onAboutClick: () => void;
}

const HomeSection: React.FC<HomeSectionProps> = ({ onGuideClick, onAboutClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3
      }
    }
  };

  const floatAnimation = {
    y: [0, -10, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut"
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center relative overflow-hidden" id="home">
      {/* Decorative Elements */}
      <motion.div
        animate={floatAnimation}
        className="absolute top-36 right-[15%] hidden md:block">
        <div className="bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg">
          <MapPin className="w-6 h-6 text-blue-500" />
        </div>
      </motion.div>
      <motion.div
        animate={floatAnimation}
        transition={{ delay: 1 }}
        className="absolute bottom-40 left-[15%] hidden md:block">
        <div className="bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg">
          <Star className="w-6 h-6 text-yellow-400" />
        </div>
      </motion.div>
      {/* Main Content */}
      <motion.div
        initial="hidden"
        animate={isLoaded ? "visible" : "hidden"}
        variants={staggerContainer}
        className="z-10 mt-[75px] sm:mt-[80px] w-full max-w-4xl px-4"
      >
        <motion.div variants={fadeIn} className="flex justify-center mb-2">
          <div className="bg-blue-100/50 dark:bg-blue-900/30 px-4 py-1 rounded-full backdrop-blur-sm border border-blue-200/40 dark:border-blue-800/40 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">BPS Republik Indonesia</span>
          </div>
        </motion.div>

        <motion.h1
          variants={fadeIn}
          className={`md:max-w-[700px] mx-auto px-5 ${merriweatherSans.className} text-xl sm:text-3xl md:text-4xl lg:text-5xl text-center font-bold text-blue-800 dark:text-blue-300 md:leading-[3rem] lg:leading-[3.5rem]`}
        >
          Survei Digital Wisatawan Nusantara 2025
        </motion.h1>

        <motion.p
          variants={fadeIn}
          className={`my-4 px-2 md:px-0 text-sm sm:text-base text-center text-gray-700 dark:text-gray-300 w-full mx-auto`}
        >
          Kegiatan rutin Badan Pusat Statistik untuk mengumpulkan data wisatawan nusantara yang melakukan
          perjalanan di wilayah Indonesia. Data ini sangat dibutuhkan dalam penyusunan rencana dan kebijakan di bidang pariwisata.
        </motion.p>

        <motion.div
          variants={fadeIn}
          className="flex justify-center gap-4 mt-4 mb-7"
        >
          <button 
            onClick={onGuideClick}
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium cursor-pointer"
          >
            <span>Pelajari lebih lanjut</span>
            <ChevronDown className="w-4 h-4" />
          </button>

          <button
            onClick={onAboutClick}
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium cursor-pointer"
          >
            <span>Tentang BPS</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      </motion.div>
      {/* Hero Image section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className='z-10 relative flex flex-col items-center w-full'
      >
        <div className="absolute top-0 mr-[50%] sm:mr-[60%] md:mr-[25%] z-50">
          <motion.div
            animate={{
              y: [0, -10, 0],
              rotate: [0, 5, 0]
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg shadow-lg"
          >
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Big Data Methodology</span>
          </motion.div>
        </div>

        <div className="absolute top-0 ml-[50%] sm:ml-[60%] md:ml-[25%] z-50">
          <motion.div
            animate={{
              y: [0, -8, 0],
              rotate: [0, -3, 0]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="bg-rose-50 dark:bg-rose-900/40 p-3 rounded-lg shadow-lg"
          >
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Self Enumeration Survey</span>
            </div>
          </motion.div>
        </div>

        <Image
          src="/hero_pict.svg"
          alt="Hero Picture"
          width={650}
          height={650}
          className="mt-2 w-full mx-auto max-w-[650px] h-auto rounded-lg dark:brightness-90 dark:contrast-125"
        />

        {/* Call to action buttons - DESKTOP VERSION (absolute position over the hero) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="absolute md:bottom-0 hidden md:flex justify-center items-center w-full"
        >
          <div className="bg-blue-400/40 dark:bg-blue-600/30 backdrop-blur-md w-40 p-3 rounded-3xl flex flex-col gap-2 shadow-lg border border-white/30 dark:border-white/10">
            <motion.button
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={onGuideClick}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 py-2 rounded-2xl text-center font-bold text-white text-sm cursor-pointer shadow-md flex items-center justify-center gap-1 w-full"
            >
              <span>Panduan</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 17L17 7M17 7H8M17 7V16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>

            <Link href="/survey">
              <motion.div
                whileHover={{ scale: 1.05, y: 5 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 dark:from-indigo-600 dark:to-purple-700 py-2 rounded-2xl text-center text-white font-bold text-sm cursor-pointer shadow-md"
              >
                Mulai Survei
              </motion.div>
            </Link>
          </div>
        </motion.div>

        {/* Mobile CTA positioned between hero image and feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="md:hidden flex justify-center w-full mx-auto mt-6 mb-6"
        >
          <div className="bg-blue-400/40 dark:bg-blue-600/30 backdrop-blur-md w-56 p-3 rounded-3xl flex flex-col gap-3 shadow-lg border border-white/30 dark:border-white/10">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onGuideClick}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 py-2.5 rounded-2xl text-center font-bold text-white text-sm cursor-pointer shadow-md flex items-center justify-center gap-1"
            >
              <span>Panduan</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 17L17 7M17 7H8M17 7V16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>

            <Link href="/survey">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 dark:from-indigo-600 dark:to-purple-700 py-2.5 rounded-2xl text-center text-white font-bold text-sm cursor-pointer shadow-md"
              >
                Mulai Survei
              </motion.div>
            </Link>
          </div>
        </motion.div>

        {/* Decorative Circles */}
        <div className="absolute -z-10 -top-8 -left-8 w-20 h-20 rounded-full border-4 border-dashed border-blue-300 dark:border-blue-600 opacity-60"></div>
        <div className="absolute -z-10 -bottom-10 -right-5 w-16 h-16 rounded-full border-4 border-dashed border-rose-300 dark:border-rose-600 opacity-60"></div>
      </motion.div>
      {/* Feature Cards */}
      <motion.div
        initial="hidden"
        animate={isLoaded ? "visible" : "hidden"}
        variants={staggerContainer}
        className="z-10 flex flex-wrap justify-center gap-4 px-4 mb-6 mt-0 sm:mt-8"
      >
        {[
          { icon: <Map className="w-5 h-5 text-rose-500" />, title: "Wisatawan Nusantara", desc: "Seseorang yang melakukan perjalanan di wilayah Indonesia dengan lama < 12 bulan" },
          { icon: <Backpack className="w-5 h-5 text-green-500" />, title: "Perjalanan Wisata", desc: "Berwisata ke objek wisata atau mengunjungi Kab/Kota lain minimal 6 jam" },
          { icon: <MapPin className="w-5 h-5 text-amber-500" />, title: "Mobile Positioning", desc: "Pemanfaatan data posisi seluler untuk analisis statistik perjalanan" },
        ].map((feature, idx) => (
          <motion.div
            key={idx}
            variants={fadeIn}
            whileHover={{ y: -5, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-100 dark:border-gray-700 py-4 px-5 rounded-xl shadow-md w-full max-w-[235px]"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-700">
                {feature.icon}
              </div>
              <h3 className="font-medium text-sm dark:text-white">{feature.title}</h3>
            </div>
            <p className="text-xs text-justify text-gray-500 dark:text-gray-400">{feature.desc}</p>
          </motion.div>
        ))}
      </motion.div>
      {/* Statistics Counters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.2 }}
        className="z-10 w-full max-w-4xl flex justify-center gap-8 px-4 mb-8"
      >
        {[
          { value: "38", label: "Provinsi" },
          { value: "514", label: "Kabupaten/Kota" },
          { value: "6", label: "Bulan" }
        ].map((stat, idx) => (
          <div key={idx} className="text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 1.5 + idx * 0.2 }}
              className="text-xl md:text-2xl font-bold text-blue-700 dark:text-blue-400"
            >
              {stat.value}
            </motion.div>
            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default HomeSection;